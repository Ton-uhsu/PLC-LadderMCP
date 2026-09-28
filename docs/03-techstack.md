# PLC-LadderMCP Tech Stack

**Document:** `docs/03-techstack.md`  
**Status:** Architecture Decision  
**Version:** 0.1  
**Date:** 2026-09-28

## 1. Goal

PLC-LadderMCP is AI-first. The web application is primarily for Ladder preview, validation, diff/review, project handling, and vendor export. The canonical program representation is Ladder IR; vendor CSV files are generated outputs, not the source of truth.

## 2. Selected Stack

| Layer | Technology | Purpose |
| --- | --- | --- |
| Language | TypeScript | Shared types across Web, Ladder Engine, adapters, and MCP |
| Web | React 19 | Application UI |
| Build | Vite | Web development/build |
| Styling | Tailwind CSS | UI styling |
| Ladder Renderer | React + SVG | Deterministic Ladder visualization from IR |
| Client State | Zustand | Lightweight application/project state |
| Schema Validation | Zod | Runtime validation of Ladder IR and tool input |
| MCP Server | Node.js + TypeScript | AI-facing semantic tool interface |
| Package Layout | Monorepo | Share IR/types/compiler code without duplication |

No database or authentication is required for the first MVP. Projects can initially be represented as JSON and imported/exported locally.

## 3. Proposed Repository Structure

```text
apps/
└── web/                       React 19 + TypeScript + Vite

packages/
├── ladder-ir/                 canonical IR + Zod schemas
├── ladder-validator/          semantic/device/topology validation
├── ladder-renderer/           React + SVG Ladder preview
├── gxworks2-adapter/          GX Works2 parser/serializer
└── samsoar-adapter/           SamSoar2022 parser/serializer

services/
└── mcp-server/                Node.js + TypeScript MCP server
```

The exact package boundaries may evolve, but vendor-specific code must remain outside the canonical Ladder IR.

## 4. Core Data Flow

```text
                       AI Agent
                          │
                          ▼
                     MCP Server
                          │
                          ▼
                      Ladder IR
                    /     │      \
                   /      │       \
                  ▼       ▼        ▼
            SVG Preview Validator Compiler
                                  │
                         ┌────────┴────────┐
                         ▼                 ▼
                  GX Works2 Adapter  SamSoar Adapter
                         │                 │
                         ▼                 ▼
                    Import CSV        Import CSV
                         │                 │
                         ▼                 ▼
                    GX Works2         SamSoar2022
```

The same Ladder IR must drive preview, validation, diff, and vendor export.

## 5. Frontend

### React 19 + TypeScript + Vite

The web application will use React rather than embedding a vendor IDE. It should render and inspect PLC logic independently.

Initial UI responsibilities:

- Open/create a Ladder IR project
- Display project/program/network structure
- Render Ladder networks
- Show validation errors and warnings
- Show generated changes/diff before approval
- Export to a selected PLC IDE format
- Import supported interchange files as adapters mature

The web application is not intended to become a full drag-and-drop replacement for GX Works2 or SamSoar2022 in the first MVP.

### Tailwind CSS

Tailwind CSS will be used for application layout and UI styling. Ladder symbols themselves should not depend on CSS tricks; their geometry belongs in the SVG renderer.

### Zustand

Zustand will initially hold UI/project state such as:

- active project
- selected program/network
- validation result
- pending AI changes
- preview state
- undo/history state when implemented

If application state remains small, avoid adding a larger state framework.

## 6. Ladder Renderer

Use React + SVG.

SVG is selected because Ladder is a structured technical diagram and requires predictable geometry for:

- power rails
- horizontal/vertical conductors
- NO contacts
- NC contacts
- coils
- SET/RST
- timers/counters
- function/instruction blocks
- parallel branches
- network comments

The renderer consumes Ladder IR directly.

```text
Ladder IR
    │
    ▼
layout calculation
    │
    ▼
SVG elements
    │
    ▼
Ladder Preview
```

Do not generate preview images from GX Works2/SamSoar screenshots.

## 7. Ladder IR and Validation

The canonical Ladder IR will be implemented as TypeScript types plus Zod schemas.

Conceptual example:

```ts
type Contact = {
  type: "contact";
  mode: "NO" | "NC";
  device: string;
};

type Coil = {
  type: "coil";
  device: string;
};
```

Zod provides runtime validation at boundaries such as:

```text
AI/MCP input
JSON project import
vendor parser
API/tool calls
        │
        ▼
    Zod schema
        │
        ▼
typed Ladder IR
```

Semantic validation remains a separate layer. A structurally valid object does not necessarily represent valid PLC logic.

## 8. Vendor Adapters

Vendor adapters translate between canonical Ladder IR/instruction representation and IDE interchange formats.

### GX Works2 Adapter

Current tested target:

```text
GX Works2
Simple Project
Ladder
without labels
FX3U / FX3UC test target
```

Observed format:

- list-format CSV
- UTF-16 LE
- BOM
- tab-separated
- quoted fields
- CRLF

A generated-import fixture has already reconstructed Ladder successfully, while the first completely from-scratch file exposed a row-format issue that still needs correction.

### SamSoar2022 Adapter

Observed minimal program representation:

```csv
Program,Main
Network,0
LD,M000
OUT,M001
POP
```

Observed format:

- CSV
- UTF-8 with BOM
- instruction-oriented networks

A completely from-scratch minimal `M0 -> M1` CSV has been successfully imported into SamSoar2022.

## 9. MCP Server

MCP will use Node.js + TypeScript so the server can directly share Ladder IR schemas and compiler packages.

The MCP interface should expose semantic operations such as:

```text
create_project
get_project
get_network
add_contact
add_coil
add_branch
update_element
delete_element
validate_project
get_diff
export_project
```

Avoid exposing low-level operations such as `write_csv_line` as the primary AI API.

The intended boundary is:

```text
AI says WHAT Ladder change it wants
              │
              ▼
MCP validates semantic operation
              │
              ▼
Ladder Engine determines HOW to represent it
              │
              ▼
Vendor Adapter determines HOW to serialize it
```

## 10. Persistence

No database is required for the first MVP.

Initial persistence:

```text
Ladder Project <-> JSON
Generated vendor files -> download/export
```

Later candidates, only when requirements justify them:

- PostgreSQL for projects/users/version metadata
- object storage for generated artifacts
- authentication/authorization
- server-side project history

Do not introduce these into the MVP only for future-proofing.

## 11. Testing

Tests should be fixture-driven.

```text
tests/
└── fixtures/
    ├── gxworks2/
    └── samsoar2022/
```

Each supported Ladder feature should eventually have:

1. IR fixture
2. expected compiled instruction representation
3. expected vendor serialization
4. parser/round-trip test where supported
5. manual IDE compatibility result for reference fixtures

The real exported/imported files discovered during research should become compatibility fixtures where licensing and repository policy permit.

## 12. MVP Implementation Order

```text
1. Monorepo scaffold
2. ladder-ir
3. minimal SVG renderer
4. validator
5. SamSoar2022 serializer
6. fix + implement GX Works2 serializer
7. web import/export workflow
8. additional Ladder instructions/branches
9. MCP server
10. diff / approval / history
```

MCP comes after the core IR/compiler path is usable. This prevents the AI interface from becoming coupled to temporary CSV manipulation.

## 13. Decisions Intentionally Deferred

Not selected yet:

- database
- authentication provider
- cloud hosting provider
- backend web framework
- component library
- collaborative editing
- direct PLC communication
- PLC online write/download
- proprietary project-binary editing

These should be selected only when a concrete requirement needs them.

## 14. Current Decision

The MVP stack is:

```text
TypeScript
├── React 19 + Vite + Tailwind
├── React + SVG Ladder Renderer
├── Zustand
├── Zod
├── Ladder IR / Validator / Compiler
├── GX Works2 Adapter
├── SamSoar2022 Adapter
└── Node.js MCP Server
```

The key architectural rule is:

> **Ladder IR is the source of truth. The Web UI, MCP tools, validator, and vendor exporters all operate around the same canonical representation.**
