# PLC-LadderMCP Server

MCP + HTTP server for semantic PLC Ladder operations on canonical IR v0.2.

## Canonical state

The server stores `LadderProjectV02` directly. AI tools mutate semantic topology and actions; they do not edit GX Works2 or SamSoar CSV rows directly.

Current FX3U support includes:
- multiple networks
- series conditions
- nested/parallel condition topology
- pulse contacts
- parallel output actions
- SET/RST
- timers/counters
- generic instructions
- GX Works2 List export/import
- diff/approval
- history undo/redo
- JSON persistence

## MCP tools

The MCP surface is now **proposal-only for Ladder writes**. AI clients cannot approve/reject proposals, cannot call undo/redo, and cannot pass an `apply=true` escape hatch.

Primary AI workflow:

- `get_project`
- `get_fx3u_capabilities`
- `propose_changes` — primary multi-operation write tool
- `list_pending_changes`
- `validate_project`
- `export_project`

Single-change proposal helpers:

- `add_contact`
- `set_parallel_conditions`
- `add_coil`
- `add_set`
- `add_reset`
- `add_timer`
- `add_counter`
- `add_instruction`
- `add_parallel_action`
- `remove_contact`
- `remove_action`
- `replace_device`
- `delete_network`
- `modify_network`

Project/file helpers:

- `list_saved_projects`
- `save_project` — snapshot only; does not change Ladder logic
- `load_project` — proposal-only
- `import_gxworks2` — proposal-only
- `get_history` — read-only

Human-only operations are intentionally **not exposed through MCP**:

- approve pending change
- reject pending change
- undo
- redo
- direct project/network creation

For a new project or a new network, the AI should use one `propose_changes` batch containing all required operations so the final proposed state can be validated before the human approves it.

Example:

```text
propose_changes(
  operations=[
    {type:"create_project", name:"Pump Control"},
    {type:"add_contact", device:"X0", network_id:0},
    {type:"add_coil", device:"Y0", network_id:0},

    {type:"create_network", network_id:1, comment:"Timer"},
    {type:"add_contact", device:"M0", network_id:1},
    {type:"add_timer", timer:"T0", preset:10, network_id:1}
  ]
)
```

This creates one pending proposal. Canonical IR remains unchanged until the Web user presses **Approve**.

## Nested FX3U conditions

The canonical IR now represents condition topology rather than only flat contact arrays.

Example:

```text
(M10 AND M11) OR (M12 AND NOT M13) -> Y10
```

Semantic call:

```text
set_parallel_conditions(
  network_id=0,
  branches=[
    [{device:"M10"},{device:"M11"}],
    [{device:"M12"},{device:"M13",mode:"NC"}]
  ]
)
```

The FX3U compiler derives branch instructions such as `ORB` from topology. `ANB` is used when a nested parallel block must be AND-composed after an existing accumulator.

## FX3U capability evidence

`get_fx3u_capabilities` exposes machine-readable exact operand forms backed by real GX Works2 verification evidence.

Examples already recorded include:
- `MOV K100 D0`
- `ADD D0 D1 D2`
- `CMP D0 D1 M30`
- `SFTL M200 M210 K8 K1`
- `SFTR M220 M230 K8 K1`
- `NEG D68`

Known rejected exact forms are also recorded so the validator can block them, including:
- `SFTL D60 K4 K1`
- `SFTR D61 K4 K1`
- `NEG D68 D69`

A generic instruction with no exact evidence record is allowed only if otherwise structurally valid, but validation returns a warning that its exact operand form is unverified.

## GX Works2 import

The GX Works2 List parser accepts the tested quoted tab-separated List format and reconstructs IR v0.2 for the currently supported subset.

It understands:
- LD / LDI
- LDP / LDF
- AND / ANI / ANP / ANF
- OR / ORI / ORP / ORF
- ORB / ANB topology
- MPS / MRD / MPP output fanout
- OUT / SET / RST
- timer/counter OUT forms
- generic instruction rows

The Web **Import GX Works2** button detects UTF-16 LE BOM or UTF-8 text and imports through the server when connected.

## Persistence

Every applied mutation autosaves the current canonical project at the repository root:

```text
<repo>/.plc-ladder/current-project.json
```

This path is resolved from the server module location, not from the npm workspace working directory. Older data accidentally written under `services/mcp-server/.plc-ladder/` is copied into the repository-root data directory automatically on startup.

Named snapshots are stored in:

```text
<repo>/.plc-ladder/projects/
```

MCP:

```text
save_project(name="my-machine")
list_saved_projects()
load_project(name="my-machine")
```

The Web contains a **Project files** panel for the same flow.

The persistence directory can be changed with:

```bash
PLC_LADDER_DATA_DIR=/path/to/data
```

History itself is currently in-memory and resets when the server process restarts; the canonical project is persisted.

## Safe AI edit flow

The enforced boundary is:

```text
Human request
    ↓
AI / Remote MCP
    ↓
propose_changes or proposal-only helper
    ↓
Pending Change
    ↓
Web AI Changes
    ├── diff
    ├── validation
    ├── Reject
    └── Approve
          ↓
      Canonical IR
```

All MCP Ladder write tools return `applied=false` and a `pending_change_id`. There is no MCP `apply` parameter.

The AI also has no MCP tool for approval, rejection, undo, or redo. Those controls remain on the human-facing Web/HTTP path.

For multi-step work, use one batch rather than many dependent proposals. For example, creating a new network with only `create_network` would be incomplete; a batch can create the network, add its conditions, and add its output before validation runs.

Pending proposals become stale if the canonical project changes after the preview. Invalid proposals cannot be approved.

The Web **AI Changes** screen polls the review queue automatically while open.

## History / undo / redo

Applied mutations, direct edits, and approved AI changes are added to a bounded 50-snapshot undo history.

```text
MCP: get_history()        # read-only
Web: Undo / Redo buttons # human action
```

The Web **History** screen shows the same change log and Undo/Redo controls.

## HTTP API

```text
GET  /health
GET  /api/project
POST /api/project

GET  /api/projects
POST /api/projects/save
POST /api/projects/load

POST /api/import/project
POST /api/import/gxworks2

POST /api/network
POST /api/contact
POST /api/conditions/parallel
POST /api/coil
POST /api/set
POST /api/reset
POST /api/timer
POST /api/counter
POST /api/instruction
POST /api/parallel-action

POST /api/edit/remove-contact
POST /api/edit/remove-action
POST /api/edit/replace-device
POST /api/edit/delete-network
POST /api/edit/modify-network

GET  /api/changes
POST /api/changes/approve
POST /api/changes/reject

GET  /api/history
POST /api/history/undo
POST /api/history/redo

GET  /api/capabilities
POST /api/validate
GET  /api/export/gxworks2
GET  /api/export/samsoar2022

POST /mcp
```

## Local run

From repository root:

```bash
npm ci
npm run mcp:build
npm run mcp:test
npm run mcp:e2e
npm run server
```

Web:

```bash
npm run dev
```

Local server:

```text
http://localhost:3001
```

Remote MCP endpoint:

```text
http://localhost:3001/mcp
```

## Remote MCP + security

For local-only development, authentication can remain disabled.

For Cloudflare Tunnel or any non-local exposure, start the server with a bearer token.

Git Bash:

```bash
export PLC_LADDER_TOKEN="replace-with-a-long-random-secret"
export PLC_LADDER_REQUIRE_AUTH=true
npm run server
```

Then start Quick Tunnel separately:

```bash
cloudflared tunnel --protocol http2 --url http://localhost:3001
```

Use the generated URL as:

```text
https://xxxxx.trycloudflare.com/mcp
```

Remote clients must send:

```text
Authorization: Bearer replace-with-a-long-random-secret
```

The Web has an optional Bearer Token field and sends the same header to all protected API calls.

If `PLC_LADDER_REQUIRE_AUTH=true` is set without `PLC_LADDER_TOKEN`, the server refuses to start.

## Tests

CI now runs:

```text
npm ci
npm run mcp:build
npm run mcp:test
npm run mcp:e2e
npm run build
```

The remote MCP E2E test uses the real MCP SDK client against the local Streamable HTTP endpoint with bearer authentication and verifies that semantic tools are discoverable.

## Current boundaries

- Target is Mitsubishi FX3U / GX Works2 first.
- GX Works2 import is for the supported List-format subset, not proprietary project binaries.
- SamSoar support remains a smaller compatibility slice.
- Exact operand verification is evidence-based; untested operand combinations are not labeled GX-verified.
- Persistence currently stores JSON on the server filesystem; there is no multi-user database.
- Authentication is shared-token bearer auth, not user/account authorization.
- Direct online PLC write/download is out of scope.
