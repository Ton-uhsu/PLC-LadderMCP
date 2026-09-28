# PLC-LadderMCP Server

Initial MCP server for semantic Ladder operations.

## Current tools

- `create_project`
- `get_project`
- `add_contact`
- `add_coil`
- `validate_project`
- `export_project` (SamSoar2022 first)

The server modifies canonical Ladder IR. It does not expose raw CSV editing as an AI tool.

## Run locally

From the repository root:

```bash
npm install
npm run mcp:build
npm run mcp:dev
```

The MCP transport is stdio. An MCP-capable client should launch:

```bash
node services/mcp-server/dist/index.js
```

## First test

An AI client can call, in order:

```text
create_project(name="Test", plc_family="Mitsubishi FX", plc_model="FX3U")
add_contact(device="M0", mode="NO")
add_coil(device="M1")
validate_project()
get_project()
export_project(target="samsoar2022")
```

Expected semantic Ladder:

```text
M0
--| |--------------------( M1 )
```

## Current boundary

Project state is in-memory and belongs to the MCP server process. Synchronization with the deployed GitHub Pages web app is the next integration step.
