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
process.env.PLC_LADDER_WEB_USERNAME = "admin";
process.env.PLC_LADDER_WEB_PASSWORD = "web-secret";
process.env.PLC_LADDER_WEB_SESSION_SECRET = "e2e-web-session-secret";
rmSync(testDataDir, { recursive: true, force: true });

const { createApplicationServer } = await import("./server.js");

const machineToken = "e2e-machine-secret";
const server = createApplicationServer({ token: machineToken });
server.listen(0, "127.0.0.1");
await once(server, "listening");

const address = server.address();
if (!address || typeof address === "string") throw new Error("Expected TCP server address.");
const base = `http://127.0.0.1:${address.port}`;
const machineAuth = { authorization: "Bearer " + machineToken };

try {
  const health = await fetch(base + "/health");
  assert.equal(health.status, 200);
  const healthBody = await health.json() as { auth_required?: boolean };
  assert.equal(healthBody.auth_required, true);

  const unauthorized = await fetch(base + "/api/project");
  assert.equal(unauthorized.status, 401);

  // The MCP machine token must not become a human Web API credential.
  const machineTokenOnWebApi = await fetch(base + "/api/project", { headers: machineAuth });
  assert.equal(machineTokenOnWebApi.status, 401);

  const badLogin = await fetch(base + "/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "wrong" }),
  });
  assert.equal(badLogin.status, 401);

  const login = await fetch(base + "/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "web-secret" }),
  });
  assert.equal(login.status, 200);
  const loginBody = await login.json() as { token: string; user: { username: string } };
  assert.equal(loginBody.user.username, "admin");
  assert.ok(loginBody.token);
  const webAuth = { authorization: "Bearer " + loginBody.token };

  const session = await fetch(base + "/auth/session", { headers: webAuth });
  assert.equal(session.status, 200);

  const authorized = await fetch(base + "/api/project", { headers: webAuth });
  assert.equal(authorized.status, 200);

  const client = new Client({ name: "plc-ladder-e2e", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(base + "/mcp"), {
    requestInit: { headers: machineAuth },
  });
  await client.connect(transport);

  const tools = await client.listTools();
  const names = new Set(tools.tools.map(tool => tool.name));
  assert.ok(names.has("propose_project"));
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
    name: "propose_project",
    arguments: {
      name: "AI Human Review E2E",
      networks: [
        {
          network_id: 0,
          condition: { type: "series", contacts: [{ device: "M0", mode: "NO", edge: "none" }] },
          actions: [{ type: "coil", device: "Y0" }],
        },
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

  // Approval happens through the human-facing Web session, never through the MCP token.
  const approve = await fetch(base + "/api/changes/approve", {
    method: "POST",
    headers: { ...webAuth, "content-type": "application/json" },
    body: JSON.stringify({ pending_change_id: proposal.pending_change_id }),
  });
  assert.equal(approve.status, 200);

  const approvedProject = await fetch(base + "/api/project", { headers: webAuth });
  const approvedBody = await approvedProject.json() as any;
  assert.equal(approvedBody.name, "AI Human Review E2E");
  assert.equal(approvedBody.programs[0].networks[0].root.children[0].device.address, "M0");

  await client.close();
  console.log("PASS remote MCP machine auth + Web login/session separation e2e");
} finally {
  server.close();
  await once(server, "close");
  rmSync(testDataDir, { recursive: true, force: true });
}
