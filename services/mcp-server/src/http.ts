import http from "node:http";
import { randomBytes } from "node:crypto";
import { pathToFileURL, URL } from "node:url";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { fx3uRejectedExactForms, fx3uVerifiedForms } from "@plc-ladder-mcp/ladder-ir";
import {
  addCoil,
  addContact,
  addCounter,
  addInstruction,
  addParallelAction,
  addReset,
  addSet,
  addTimer,
  approvePendingChange,
  createNetwork,
  createProject,
  deleteNetwork,
  exportGxWorks2Text,
  exportSamSoar,
  getHistory,
  getProject,
  importGxWorks2Text,
  importProjectJson,
  listPendingChanges,
  listSavedProjects,
  loadProjectSnapshot,
  modifyNetwork,
  redoProject,
  rejectPendingChange,
  removeAction,
  removeContact,
  replaceDevice,
  saveProjectSnapshot,
  setParallelConditions,
  undoProject,
  validateProject,
} from "./project.js";
import { createMcpServer } from "./mcp.js";

const allowedOrigin = process.env.CORS_ORIGIN ?? "*";

function cors() {
  return {
    "access-control-allow-origin": allowedOrigin,
    "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type,authorization,x-api-key,mcp-session-id,mcp-protocol-version,last-event-id",
    "access-control-expose-headers": "mcp-session-id",
  };
}

function send(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", ...cors() });
  res.end(status === 204 ? undefined : JSON.stringify(body, null, 2));
}

async function readJson(req: http.IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function bearerToken(req: http.IncomingMessage) {
  const authorization = req.headers.authorization ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  return match?.[1] ?? (Array.isArray(req.headers["x-api-key"]) ? req.headers["x-api-key"][0] : req.headers["x-api-key"]) ?? "";
}

export function createHttpServer(options: { token?: string } = {}) {
  const token = options.token ?? process.env.PLC_LADDER_TOKEN?.trim() ?? "";

  return http.createServer(async (req, res) => {
    if (req.method === "OPTIONS") return send(res, 204, {});
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    try {
      if (url.pathname === "/health") {
        return send(res, 200, {
          ok: true,
          service: "plc-ladder-mcp",
          version: "0.3.0",
          ir: "0.2",
          mcp: "/mcp",
          auth_required: Boolean(token),
        });
      }

      if (token && bearerToken(req) !== token) {
        return send(res, 401, { error: "Unauthorized. Send Authorization: Bearer <token>." });
      }

      if (url.pathname === "/mcp") {
        if (req.method !== "POST") return send(res, 405, { error: "Remote MCP uses POST /mcp" });
        const body = await readJson(req);
        const mcp = createMcpServer();
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
        res.on("close", () => { void transport.close(); void mcp.close(); });
        await mcp.connect(transport);
        await transport.handleRequest(req, res, body);
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/capabilities")
        return send(res, 200, { verified_forms: fx3uVerifiedForms, rejected_forms: fx3uRejectedExactForms });

      if (req.method === "GET" && url.pathname === "/api/project")
        return send(res, 200, getProject());

      if (req.method === "POST" && url.pathname === "/api/project") {
        const b = await readJson(req) as any;
        return send(res, 200, createProject(
          b.name ?? "Untitled PLC Project",
          b.plc_family ?? "Mitsubishi FX",
          b.plc_model ?? "FX3U",
        ));
      }

      if (req.method === "GET" && url.pathname === "/api/projects")
        return send(res, 200, listSavedProjects());

      if (req.method === "POST" && url.pathname === "/api/projects/save") {
        const b = await readJson(req) as any;
        return send(res, 200, saveProjectSnapshot(b.name));
      }

      if (req.method === "POST" && url.pathname === "/api/projects/load") {
        const b = await readJson(req) as any;
        return send(res, 200, loadProjectSnapshot(b.name));
      }

      if (req.method === "POST" && url.pathname === "/api/import/project") {
        const b = await readJson(req) as any;
        return send(res, 200, importProjectJson(String(b.content ?? ""), b.source ?? "HTTP"));
      }

      if (req.method === "POST" && url.pathname === "/api/import/gxworks2") {
        const b = await readJson(req) as any;
        return send(res, 200, importGxWorks2Text(String(b.content ?? "")));
      }

      if (req.method === "POST" && url.pathname === "/api/network") {
        const b = await readJson(req) as any;
        return send(res, 200, { created: createNetwork(b.comment, b.network_id), project: getProject() });
      }

      if (req.method === "POST" && url.pathname === "/api/contact") {
        const b = await readJson(req) as any;
        return send(res, 200, {
          added: addContact(b.device, b.mode ?? "NO", b.network_id ?? 0),
          project: getProject(),
        });
      }

      if (req.method === "POST" && url.pathname === "/api/conditions/parallel") {
        const b = await readJson(req) as any;
        return send(res, 200, {
          condition: setParallelConditions(Array.isArray(b.branches) ? b.branches : [], b.network_id ?? 0),
          project: getProject(),
        });
      }

      if (req.method === "POST" && url.pathname === "/api/coil") {
        const b = await readJson(req) as any;
        return send(res, 200, { added: addCoil(b.device, b.network_id ?? 0), project: getProject() });
      }

      if (req.method === "POST" && url.pathname === "/api/set") {
        const b = await readJson(req) as any;
        return send(res, 200, { added: addSet(b.device, b.network_id ?? 0), project: getProject() });
      }

      if (req.method === "POST" && url.pathname === "/api/reset") {
        const b = await readJson(req) as any;
        return send(res, 200, { added: addReset(b.device, b.network_id ?? 0), project: getProject() });
      }

      if (req.method === "POST" && url.pathname === "/api/timer") {
        const b = await readJson(req) as any;
        return send(res, 200, { added: addTimer(b.timer, Number(b.preset), b.network_id ?? 0), project: getProject() });
      }

      if (req.method === "POST" && url.pathname === "/api/counter") {
        const b = await readJson(req) as any;
        return send(res, 200, { added: addCounter(b.counter, Number(b.preset), b.network_id ?? 0), project: getProject() });
      }

      if (req.method === "POST" && url.pathname === "/api/instruction") {
        const b = await readJson(req) as any;
        return send(res, 200, {
          added: addInstruction(b.opcode, Array.isArray(b.operands) ? b.operands : [], b.network_id ?? 0),
          project: getProject(),
        });
      }

      if (req.method === "POST" && url.pathname === "/api/parallel-action") {
        const b = await readJson(req) as any;
        return send(res, 200, {
          added: addParallelAction(b.kind, b.value, Array.isArray(b.operands) ? b.operands : [], b.network_id ?? 0),
          project: getProject(),
        });
      }

      if (req.method === "POST" && url.pathname === "/api/edit/remove-contact") {
        const b = await readJson(req) as any;
        return send(res, 200, removeContact(b.contact_id, b.network_id ?? 0, b.apply ?? false));
      }

      if (req.method === "POST" && url.pathname === "/api/edit/remove-action") {
        const b = await readJson(req) as any;
        return send(res, 200, removeAction(b.action_id, b.network_id ?? 0, b.apply ?? false));
      }

      if (req.method === "POST" && url.pathname === "/api/edit/replace-device") {
        const b = await readJson(req) as any;
        return send(res, 200, replaceDevice(b.from_device, b.to_device, b.network_id, b.apply ?? false));
      }

      if (req.method === "POST" && url.pathname === "/api/edit/delete-network") {
        const b = await readJson(req) as any;
        return send(res, 200, deleteNetwork(b.network_id, b.apply ?? false));
      }

      if (req.method === "POST" && url.pathname === "/api/edit/modify-network") {
        const b = await readJson(req) as any;
        return send(res, 200, modifyNetwork(b.network_id, b.comment ?? null, b.apply ?? false));
      }

      if (req.method === "GET" && url.pathname === "/api/changes")
        return send(res, 200, listPendingChanges());

      if (req.method === "POST" && url.pathname === "/api/changes/approve") {
        const b = await readJson(req) as any;
        return send(res, 200, approvePendingChange(b.pending_change_id));
      }

      if (req.method === "POST" && url.pathname === "/api/changes/reject") {
        const b = await readJson(req) as any;
        return send(res, 200, rejectPendingChange(b.pending_change_id));
      }

      if (req.method === "GET" && url.pathname === "/api/history")
        return send(res, 200, getHistory());

      if (req.method === "POST" && url.pathname === "/api/history/undo")
        return send(res, 200, undoProject());

      if (req.method === "POST" && url.pathname === "/api/history/redo")
        return send(res, 200, redoProject());

      if (req.method === "POST" && url.pathname === "/api/validate")
        return send(res, 200, validateProject());

      if (req.method === "GET" && url.pathname === "/api/export/gxworks2") {
        return send(res, 200, {
          target: "gxworks2",
          encoding: "UTF-16 LE with BOM required at file boundary",
          content: exportGxWorks2Text(),
        });
      }

      if (req.method === "GET" && url.pathname === "/api/export/samsoar2022") {
        res.writeHead(200, {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": 'attachment; filename="plc-ladder-samsoar.csv"',
          ...cors(),
        });
        return res.end(exportSamSoar());
      }

      return send(res, 404, { error: "Not found" });
    } catch (error) {
      if (!res.headersSent) {
        return send(res, 400, { error: error instanceof Error ? error.message : String(error) });
      }
      res.end();
    }
  });
}

function generateToken() {
  return randomBytes(32).toString("base64url");
}

export function startHttpServer() {
  const envToken = process.env.PLC_LADDER_TOKEN?.trim() ?? "";
  const authOptOut = /^(0|false|no|off)$/i.test(process.env.PLC_LADDER_REQUIRE_AUTH ?? "");
  const token = envToken || (authOptOut ? "" : generateToken());
  const generatedToken = !envToken && token.length > 0;

  const port = Number(process.env.PORT ?? 3001);
  const server = createHttpServer({ token });
  server.listen(port, "0.0.0.0", () => {
    console.log(`PLC-LadderMCP HTTP + Remote MCP: http://localhost:${port}`);
    console.log(`Health: http://localhost:${port}/health`);
    console.log(`Remote MCP: http://localhost:${port}/mcp`);
    if (!token) {
      console.log("Auth: disabled (PLC_LADDER_REQUIRE_AUTH=false). Do not expose this server publicly.");
      return;
    }
    console.log(generatedToken ? "Auth: enabled, token auto-generated for this run." : "Auth: Bearer token required.");
    console.log("");
    console.log("  Paste this into the web app's Bearer token field:");
    console.log("");
    console.log(`  ${token}`);
    console.log("");
    if (generatedToken) {
      console.log("  Set PLC_LADDER_TOKEN to reuse the same token across restarts.");
    }
  });
  return server;
}

const isMain = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (isMain) startHttpServer();
