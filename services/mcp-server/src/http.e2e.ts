import assert from "node:assert/strict";
import { once } from "node:events";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createHttpServer } from "./http.js";

const token = "e2e-secret";
const server = createHttpServer({ token });
server.listen(0, "127.0.0.1");
await once(server, "listening");

const address = server.address();
if (!address || typeof address === "string") throw new Error("Expected TCP server address.");
const base = `http://127.0.0.1:${address.port}`;

try {
  const health = await fetch(base + "/health");
  assert.equal(health.status, 200);
  const healthBody = await health.json() as { auth_required?: boolean };
  assert.equal(healthBody.auth_required, true);

  const unauthorized = await fetch(base + "/api/project");
  assert.equal(unauthorized.status, 401);

  const authorized = await fetch(base + "/api/project", {
    headers: { authorization: "Bearer " + token },
  });
  assert.equal(authorized.status, 200);

  const client = new Client({ name: "plc-ladder-e2e", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(base + "/mcp"), {
    requestInit: { headers: { authorization: "Bearer " + token } },
  });
  await client.connect(transport);

  const tools = await client.listTools();
  const names = new Set(tools.tools.map(tool => tool.name));
  assert.ok(names.has("create_project"));
  assert.ok(names.has("set_parallel_conditions"));
  assert.ok(names.has("import_gxworks2"));
  assert.ok(names.has("save_project"));
  assert.ok(names.has("get_history"));

  await client.close();
  console.log("PASS remote MCP Streamable HTTP + bearer auth e2e");
} finally {
  server.close();
  await once(server, "close");
}
