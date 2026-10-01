import http from "node:http";
import { randomBytes } from "node:crypto";
import { pathToFileURL, URL } from "node:url";
import { compileWithDiagnostics, vendorArtifact } from "@plc-ladder-mcp/ladder-ir";
import { getProject, saveManualProject } from "./project.js";
import { z } from "zod";
import { createHttpServer } from "./http.js";
import { createWebAuth, type WebAuth } from "./auth/web-auth.js";

import { createDatabase } from "./persistence/database.js";
import { ProjectRepository } from "./persistence/projects.js";
import { handleProjectPersistence } from "./persistence/http.js";

function bearerToken(req: http.IncomingMessage) {
  const authorization = req.headers.authorization ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  return match?.[1] ?? "";
}

async function readJson(req: http.IncomingMessage) {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of req) {
    length += Buffer.byteLength(chunk); if (length > 4 * 1024 * 1024) throw new Error("Request too large.");
    chunks.push(Buffer.from(chunk));
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function corsHeaders() {
  return {
    "access-control-allow-origin": process.env.CORS_ORIGIN ?? "*",
    "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type,authorization,x-api-key,mcp-session-id,mcp-protocol-version,last-event-id",
  };
}

function send(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", ...corsHeaders() });
  res.end(JSON.stringify(body, null, 2));
}

function generateMachineToken() {
  return randomBytes(32).toString("base64url");
}

export function createApplicationServer(options: { token?: string; webAuth?: WebAuth; projectRepository?: ProjectRepository } = {}) {
  const localCompiles = new Map<string,{snapshot:string;status:string}>();
  const machineToken = options.token ?? process.env.PLC_LADDER_TOKEN?.trim() ?? "";
  const webAuth = options.webAuth ?? createWebAuth();
  const legacy = createHttpServer({ token: machineToken });
  const legacyHandler = legacy.listeners("request")[0] as (
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ) => void;

  return http.createServer(async (req, res) => {
    if (req.method === "OPTIONS") return legacyHandler(req, res);

    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    try {
      if (url.pathname === "/auth/login") {
        if (req.method !== "POST") return send(res, 405, { error: "POST /auth/login required." });
        if (!webAuth.enabled) {
          return send(res, 503, {
            error: "Web login is not configured. Set PLC_LADDER_WEB_USERNAME and PLC_LADDER_WEB_PASSWORD.",
          });
        }

        const body = await readJson(req) as { username?: string; password?: string };
        if (!webAuth.authenticate(String(body.username ?? ""), String(body.password ?? ""))) {
          return send(res, 401, { error: "Invalid username or password." });
        }

        const token = webAuth.issueSession();
        const session = webAuth.verifySession(token)!;
        return send(res, 200, {
          token,
          expires_at: new Date(session.exp * 1000).toISOString(),
          user: { username: session.sub, role: session.role },
        });
      }

      if (url.pathname === "/auth/session") {
        if (req.method !== "GET") return send(res, 405, { error: "GET /auth/session required." });
        const session = webAuth.verifySession(bearerToken(req));
        if (!session) return send(res, 401, { error: "Web session is invalid or expired." });
        return send(res, 200, {
          authenticated: true,
          expires_at: new Date(session.exp * 1000).toISOString(),
          user: { username: session.sub, role: session.role },
        });
      }

      if (url.pathname === "/api/manual/project") {
        if (!webAuth.verifySession(bearerToken(req))) return send(res, 401, { error: "Human Web login required." });
        if (req.method !== "POST") return send(res, 405, { error: "POST required." });
        if (options.projectRepository) return send(res, 409, { error: "Use the selected PostgreSQL project save API." });
        const body = z.object({ baseSnapshot: z.unknown(), snapshot: z.unknown() }).strict().parse(await readJson(req));
        try { return send(res, 200, saveManualProject(body.baseSnapshot, body.snapshot)); }
        catch (error) {
          if (error instanceof Error && error.message === "STALE_MANUAL_PROJECT") return send(res, 409, { error: "Project changed. Sync now before retrying this edit." });
          throw error;
        }
      }

      if(url.pathname==='/api/manual/export'){
        const session=webAuth.verifySession(bearerToken(req));if(!session)return send(res,401,{error:'Human Web login required.'});
        if(req.method!=='POST')return send(res,405,{error:'POST required.'});
        const body=z.object({compileId:z.string().min(1),target:z.enum(['gxworks2','samsoar2022'])}).strict().parse(await readJson(req));
        const compile=localCompiles.get(`${session.sub}:${body.compileId}`),snapshot=getProject();
        if(!compile || compile.status!=='PASS' || compile.snapshot!==JSON.stringify(snapshot))return send(res,409,{error:'COMPILE_REQUIRED'});
        try{const artifact=vendorArtifact(snapshot,body.target);return send(res,200,{status:'SUCCESS',artifact:{filename:artifact.filename,mediaType:artifact.mediaType,encoding:artifact.encoding,base64:Buffer.from(artifact.bytes).toString('base64')}});}
        catch(e){return send(res,422,{error:e instanceof Error?e.message:String(e)});}
      }
      if (url.pathname === '/api/manual/compile') {
        const session = webAuth.verifySession(bearerToken(req));
        if (!session) return send(res,401,{error:'Human Web login required.'});
        if(req.method!=='POST')return send(res,405,{error:'POST required.'});
        const body=z.object({snapshot:z.unknown()}).strict().parse(await readJson(req));
        const snapshot=getProject();
        if(JSON.stringify(body.snapshot)!==JSON.stringify(snapshot))return send(res,409,{error:'Project changed. Sync before Compile.'});
        const report=compileWithDiagnostics(snapshot),id=randomBytes(16).toString('hex');
        localCompiles.set(`${session.sub}:${id}`,{snapshot:JSON.stringify(snapshot),status:report.status});
        if(localCompiles.size>100)localCompiles.delete(localCompiles.keys().next().value!);
        return send(res,200,{...report,id,snapshot,startedAt:new Date().toISOString()});
      }

      if (url.pathname === "/api/persistence/status" || url.pathname === "/api/persistence/projects" || url.pathname.startsWith("/api/persistence/projects/")) {
        const session = webAuth.verifySession(bearerToken(req));
        if (!session) return send(res, 401, { error: "Human Web login required." });
        if (url.pathname === "/api/persistence/status" && req.method === "GET") return send(res, 200, { configured: Boolean(options.projectRepository) });
        if (!options.projectRepository) return send(res, 503, { error: "PostgreSQL is not configured." });
        return await handleProjectPersistence(req, res, options.projectRepository, session.sub);
      }

      if (url.pathname.startsWith("/api/") && webAuth.enabled) {
        const session = webAuth.verifySession(bearerToken(req));
        if (!session) {
          return send(res, 401, { error: "Login required. Web API does not accept the MCP machine token." });
        }

        // The legacy HTTP layer still enforces its machine-token guard internally.
        // After validating the human session here, inject that token only inside the server process.
        if (machineToken) req.headers.authorization = `Bearer ${machineToken}`;
        else delete req.headers.authorization;
      }

      return legacyHandler(req, res);
    } catch (error) {
      if (!res.headersSent) {
        return send(res, 400, { error: error instanceof Error ? error.message : String(error) });
      }
      res.end();
    }
  });
}

export function startApplicationServer() {
  const envToken = process.env.PLC_LADDER_TOKEN?.trim() ?? "";
  const authOptOut = /^(0|false|no|off)$/i.test(process.env.PLC_LADDER_REQUIRE_AUTH ?? "");
  const machineToken = envToken || (authOptOut ? "" : generateMachineToken());
  const generatedMachineToken = !envToken && machineToken.length > 0;
  const webAuth = createWebAuth();
  const port = Number(process.env.PORT ?? 3001);
  const db = process.env.DATABASE_URL ? createDatabase(process.env.DATABASE_URL) : undefined;
  const server = createApplicationServer({ token: machineToken, webAuth,
    projectRepository: db ? new ProjectRepository(db) : undefined });
  server.on("close", () => { if (db) void db.destroy(); });

  server.listen(port, "0.0.0.0", () => {
    console.error(`PLC-LadderMCP HTTP + Remote MCP: http://localhost:${port}`);
    console.error(`Health: http://localhost:${port}/health`);
    console.error(`Remote MCP: http://localhost:${port}/mcp`);
    console.error(`Web login: http://localhost:${port}/auth/login`);

    if (!machineToken) {
      console.error("MCP auth: disabled (PLC_LADDER_REQUIRE_AUTH=false). Do not expose /mcp publicly.");
    } else {
      console.error(generatedMachineToken ? "MCP auth: machine token auto-generated for this run." : "MCP auth: machine token required.");
      console.error("");
      console.error("  Configure this token only in OpenCode / the MCP client:");
      console.error("");
      console.error(`  ${machineToken}`);
      console.error("");
      if (generatedMachineToken) console.error("  Set PLC_LADDER_TOKEN to reuse it across restarts.");
    }

    if (!webAuth.enabled) {
      console.error("Web auth: disabled. Set PLC_LADDER_WEB_USERNAME and PLC_LADDER_WEB_PASSWORD before public deployment.");
    } else {
      console.error(`Web auth: enabled for ${webAuth.username}; session TTL ${webAuth.ttlSeconds}s.`);
      if (webAuth.generatedSecret) {
        console.error("Web auth: session secret auto-generated. Set PLC_LADDER_WEB_SESSION_SECRET so logins survive server restarts.");
      }
    }
  });

  return server;
}

const isMain = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (isMain) startApplicationServer();
