import http from "node:http";
import { URL } from "node:url";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { addCoil, addContact, createProject, exportGxWorks2Text, exportSamSoar, getProject, getProjectV02, validateProject } from "./project.js";
import { createMcpServer } from "./mcp.js";

const port = Number(process.env.PORT ?? 3001);
const allowedOrigin = process.env.CORS_ORIGIN ?? "*";

function cors() {
  return {
    "access-control-allow-origin": allowedOrigin,
    "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type,mcp-session-id,mcp-protocol-version,last-event-id",
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

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, {});
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  try {
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

    if (req.method === "GET" && url.pathname === "/health")
      return send(res, 200, { ok: true, service: "plc-ladder-mcp", version: "0.2.0", mcp: "/mcp" });
    if (req.method === "GET" && url.pathname === "/api/project")
      return send(res, 200, getProjectV02());
    if (req.method === "POST" && url.pathname === "/api/project") {
      const b = await readJson(req) as any;
      return send(res, 200, createProject(b.name ?? "Untitled PLC Project", b.plc_family ?? "Mitsubishi FX", b.plc_model ?? "FX3U"));
    }
    if (req.method === "POST" && url.pathname === "/api/contact") {
      const b = await readJson(req) as any;
      return send(res, 200, { added: addContact(b.device, b.mode ?? "NO", b.network_id ?? 0), project: getProject() });
    }
    if (req.method === "POST" && url.pathname === "/api/coil") {
      const b = await readJson(req) as any;
      return send(res, 200, { added: addCoil(b.device, b.network_id ?? 0), project: getProject() });
    }
    if (req.method === "POST" && url.pathname === "/api/validate")
      return send(res, 200, validateProject());
    if (req.method === "GET" && url.pathname === "/api/export/gxworks2") {
      return send(res, 200, { target: "gxworks2", encoding: "UTF-16 LE with BOM required at file boundary", content: exportGxWorks2Text() });
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
    if (!res.headersSent) return send(res, 400, { error: error instanceof Error ? error.message : String(error) });
    res.end();
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`PLC-LadderMCP HTTP + Remote MCP: http://localhost:${port}`);
  console.log(`Health: http://localhost:${port}/health`);
  console.log(`Remote MCP: http://localhost:${port}/mcp`);
});
