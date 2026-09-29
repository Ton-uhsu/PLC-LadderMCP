import assert from "node:assert/strict";
import { once } from "node:events";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
function toolJson(result: any) {
  const text = result?.content?.find((part: any) => part.type === "text")?.text;
  if (!text) throw new Error("MCP tool did not return JSON text content.");
  return JSON.parse(text);
}

const testDataDir = join(process.cwd(), ".plc-ladder-test-e2e");
process.env.PLC_LADDER_DATA_DIR = testDataDir;
rmSync(testDataDir, { recursive: true, force: true });

const { createHttpServer } = await import("./http.js");

const token = "e2e-secret";
const server = createHttpServer({ token });
server.listen(0, "127.0.0.1");
await once(server, "listening");

const address = server.address();
if (!address || typeof address === "string") throw new Error("Expected TCP server address.");
const base = `http://127.0.0.1:${address.port}`;
const auth = { authorization: "Bearer " + token };

try {
  const health = await fetch(base + "/health");
  assert.equal(health.status, 200);
  const healthBody = await health.json() as { auth_required?: boolean };
  assert.equal(healthBody.auth_required, true);

  const unauthorized = await fetch(base + "/api/project");
  assert.equal(unauthorized.status, 401);

  const authorized = await fetch(base + "/api/project", { headers: auth });
  assert.equal(authorized.status, 200);

  const client = new Client({ name: "plc-ladder-e2e", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(base + "/mcp"), {
    requestInit: { headers: auth },
  });
  await client.connect(transport);

  const tools = await client.listTools();
  const names = new Set(tools.tools.map(tool => tool.name));
  assert.ok(names.has("propose_changes"));
  assert.ok(names.has("set_parallel_conditions"));
  assert.ok(names.has("import_gxworks2"));
  assert.ok(names.has("save_project"));
  assert.ok(names.has("get_history"));

  // Human-only controls must not be available to the AI MCP client.
  assert.equal(names.has("approve_pending_change"), false);
  assert.equal(names.has("reject_pending_change"), false);
  assert.equal(names.has("undo_project"), false);
  assert.equal(names.has("redo_project"), false);
  assert.equal(names.has("create_project"), false);
  assert.equal(names.has("create_network"), false);

  const before = toolJson(await client.callTool({ name: "get_project", arguments: {} }));

  const proposal = toolJson(await client.callTool({
    name: "propose_changes",
    arguments: {
      operations: [
        { type: "create_project", name: "AI Human Review E2E", plc_family: "Mitsubishi FX", plc_model: "FX3U" },
        { type: "add_contact", device: "M0", mode: "NO", network_id: 0 },
        { type: "add_coil", device: "Y0", network_id: 0 },
      ],
    },
  }));

  assert.equal(proposal.applied, false);
  assert.equal(proposal.validation.valid, true);
  assert.ok(proposal.pending_change_id);

  const afterProposal = toolJson(await client.callTool({ name: "get_project", arguments: {} }));
  assert.deepEqual(afterProposal, before, "AI proposal must not mutate canonical project.");

  const pending = toolJson(await client.callTool({ name: "list_pending_changes", arguments: {} }));
  assert.ok(pending.some((item: any) => item.id === proposal.pending_change_id));

  // Approval happens through the human-facing Web/HTTP control path, not MCP.
  const approve = await fetch(base + "/api/changes/approve", {
    method: "POST",
    headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ pending_change_id: proposal.pending_change_id }),
  });
  assert.equal(approve.status, 200);

  const approvedProject = await fetch(base + "/api/project", { headers: auth });
  const approvedBody = await approvedProject.json() as any;
  assert.equal(approvedBody.name, "AI Human Review E2E");
  assert.equal(approvedBody.programs[0].networks[0].root.children[0].device.address, "M0");

  await client.close();
  console.log("PASS remote MCP proposal-only + human approval + bearer auth e2e");
} finally {
  server.close();
  await once(server, "close");
  rmSync(testDataDir, { recursive: true, force: true });
}
