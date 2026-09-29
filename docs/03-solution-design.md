# PLC-LadderMCP Solution Design

**Status:** Architecture Overview / Design Index

## System context

PLC-LadderMCP is an AI-first toolchain. AI clients call semantic MCP/tool operations against a shared Ladder engine. The canonical source of truth is Ladder IR; preview, validation, diff, and vendor export all operate around that same representation.

```text
User -> AI Agent -> MCP/API -> Ladder Engine -> Ladder IR
                                      |             |
                                      |             +-> Web/SVG preview
                                      |             +-> Validator
                                      |             +-> Vendor adapters
                                      |                    +-> GX Works2
                                      |                    +-> SamSoar2022
                                      +-> Human Review / project operations
```

## Repository boundaries

- `apps/web` — React/Vite human interface for preview, validation, review, project handling, and export.
- `packages/ladder-ir` — canonical Ladder representation and schemas.
- `packages/ladder-validator` — semantic/device/topology validation.
- `packages/ladder-renderer` — deterministic SVG rendering.
- vendor adapter packages — translate between Ladder IR/instruction representations and supported IDE interchange formats.
- `services/mcp-server` — AI-facing MCP plus human HTTP/auth boundaries.

## Key architecture rules

- Ladder IR is the source of truth, not vendor CSV or screenshots.
- Vendor-specific behavior stays outside the canonical IR where practical.
- AI-facing operations express Ladder intent rather than low-level file manipulation.
- Human Web authentication and AI/MCP machine authentication remain separate boundaries.
- The Web frontend may remain on GitHub Pages while the backend runs on the VPS over HTTPS.

## Detailed designs

- [`designs/tech-stack.md`](./designs/tech-stack.md) — stack, package structure, renderer, persistence, and testing direction.
- [`designs/deployment-architecture.md`](./designs/deployment-architecture.md) — production topology and persistence roadmap.
- [`designs/authentication-access-control.md`](./designs/authentication-access-control.md) — human versus machine access boundaries.

## Contracts, research, and evidence

- [`contracts/fx3u-capability-catalog.md`](./contracts/fx3u-capability-catalog.md)
- [`research/plc-ide-import-export.md`](./research/plc-ide-import-export.md)
- [`evidence/fx3u-verification-matrix.md`](./evidence/fx3u-verification-matrix.md)

## Requirement ownership

Project requirements remain owned by [`01-requirements.md`](./01-requirements.md). The roadmap is intentionally not created until those requirements are explicitly confirmed for roadmap derivation.
