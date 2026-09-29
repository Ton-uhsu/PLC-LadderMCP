# PLC-LadderMCP Server

MCP + HTTP server for semantic PLC Ladder operations on canonical IR v0.2.

## Canonical state

The server stores `LadderProjectV02` directly. AI tools mutate topology and semantic actions; they do not edit GX Works2 or SamSoar CSV rows directly.

Current FX3U compiler slice supports series contact conditions followed by one action or parallel output actions.

## MCP tools

- `create_project`
- `get_project`
- `create_network`
- `add_contact`
- `add_coil`
- `add_set`
- `add_reset`
- `add_timer`
- `add_counter`
- `add_instruction`
- `add_parallel_action`
- `validate_project`
- `export_project` with `gxworks2` or `samsoar2022`

Timer/counter helpers emit the exact IR form used by the verified GX Works2 List representation:

```text
OUT T0 K10
OUT C0 K10
```

Generic instruction operands currently accept:
- PLC device: `D0`, `M10`, `Y0`
- decimal constant: `K100`
- hex constant: `HFF`

## Semantic example

```text
create_project(name="Parallel Demo", plc_family="Mitsubishi FX", plc_model="FX3U")
add_contact(device="M0", mode="NO", network_id=0)
add_coil(device="Y0", network_id=0)
add_parallel_action(kind="set", value="M10", network_id=0)
validate_project()
export_project(target="gxworks2")
```

Canonical topology:

```text
Series
├── Contact M0
└── Parallel
    ├── Coil Y0
    └── SET M10
```

## Multiple networks

```text
create_network(network_id=1, comment="Timer")
add_contact(device="X0", mode="NO", network_id=1)
add_timer(timer="T0", preset=10, network_id=1)
```

## HTTP routes

The development HTTP server mirrors the semantic MCP operations:

```text
GET  /health
GET  /api/project
POST /api/project
POST /api/network
POST /api/contact
POST /api/coil
POST /api/set
POST /api/reset
POST /api/timer
POST /api/counter
POST /api/instruction
POST /api/parallel-action
POST /api/validate
GET  /api/export/gxworks2
GET  /api/export/samsoar2022
POST /mcp
```

## Run locally

From the repository root:

```bash
npm install
npm run mcp:build
npm run mcp:test
npm run server
```

For stdio MCP:

```bash
npm run mcp:dev
```

or after building:

```bash
node services/mcp-server/dist/index.js
```

## Current boundary

- Project state is in-memory.
- Canonical IR is v0.2.
- Parallel output actions are supported.
- Nested parallel **condition** topology is not yet part of the general semantic mutation/compiler path.
- Opcode-specific validation for every FX3U applied instruction is still being expanded.
