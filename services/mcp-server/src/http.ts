import http from "node:http";
import { URL } from "node:url";
import { addCoil, addContact, createProject, exportSamSoar, getProject, validateProject } from "./project.js";

const port = Number(process.env.PORT ?? 3001);
const allowedOrigin = process.env.CORS_ORIGIN ?? "*";

function send(res: http.ServerResponse, status: number, body: unknown) {
  const data = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": allowedOrigin,
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
  });
  res.end(data);
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
    if (req.method === "GET" && url.pathname === "/health")
      return send(res, 200, { ok: true, service: "plc-ladder-mcp", version: "0.1.0" });

    if (req.method === "GET" && url.pathname === "/api/project")
      return send(res, 200, getProject());

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

    if (req.method === "GET" && url.pathname === "/api/export/samsoar2022") {
      const csv = exportSamSoar();
      res.writeHead(200, {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="plc-ladder-samsoar.csv"',
        "access-control-allow-origin": allowedOrigin,
      });
      return res.end(csv);
    }

    // Remote MCP endpoint comes next; stdio MCP remains available via npm run mcp:dev.
    if (url.pathname === "/mcp")
      return send(res, 501, { error: "Remote MCP transport not enabled yet", hint: "REST API is ready; stdio MCP is available locally." });

    return send(res, 404, { error: "Not found" });
  } catch (error) {
    return send(res, 400, { error: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`PLC-LadderMCP HTTP server: http://localhost:${port}`);
  console.log(`Health: http://localhost:${port}/health`);
});
