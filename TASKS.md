# Current Work

## Active

None.

## Done
- [x] WORK-005 | feat: structured Ladder editor and topology renderer | 2026-10-01 | feature | → owner: docs/roadmap/phase-02-local-ui/task-005-structured-editor-renderer.md
  - Delivered: nested series/parallel SVG, element selection/inspector, stable-ID insert/remove/reorder/wrap, contact/output/timer/counter/instruction operands in both local and database modes. Fixed hex formatting and blocked unsupported NC-edge compilation; related gap evidence in TASK-003.
  - Verified: Web tests 14/14, persistence tests 7 pass/2 native skipped, Web/backend builds, IR fixture, smoke and HTTP E2E; visually inspected two rasterized React SVG fixtures.
  - Handoff: TASK-005 stays Partial for browser acceptance, typed V1 IR completion and rendered Review/Compile integration. No VPS or broad stack migration.

- [x] WORK-004 | feat: project settings and network management | 2026-10-01 | feature | → owner: docs/roadmap/phase-02-local-ui/task-004-project-network-ui.md
  - Delivered: settings/name/default target, stable-ID network controls, human-only stale-safe local manual edits and busy guards. No VPS or broad stack migration.
  - Verified: Web tests 9/9; persistence tests 7 pass/2 native skipped; Web/backend builds, semantic smoke and HTTP auth/MCP E2E.
  - Handoff: owning TASK-004 remains Partial for browser acceptance (Chromium download blocked) and durable Review/Compile context integration. Next implementation owner: TASK-005.

- [x] WORK-001 — Local PostgreSQL project/revision foundation → owner: docs/designs/persistence-database-architecture.md
  - Scope: Kysely + pg, immutable versioned IR snapshots, optimistic save/read API, local Docker Compose and guide. No VPS/deployment or broad stack migration.
  - Requirements: REQ-016, REQ-023, REQ-033, REQ-040, REQ-041, REQ-095, REQ-097, REQ-111, REQ-150, REQ-156.
  - Verify: real PostgreSQL migration/restart durability, immutable history, stale concurrent saves, rollback, metadata/logic hashes, auth boundaries, existing smoke/E2E/build.
  - Boundary: new human project API; existing UI/MCP review path stays legacy until the next persistence integration slice. No AI direct-write route.

  - Verified: embedded PostgreSQL tests, backend/Web builds, existing semantic smoke and HTTP auth/MCP E2E. Native pg multi-session suite supplied but not run here (Docker unavailable); run locally before declaring native PostgreSQL validation complete.

- [x] WORK-002 — Connect Web project picker and manual autosave to PostgreSQL → owner: docs/designs/persistence-database-architecture.md
  - Scope: UUID project selection, durable create/read/save, debounced serialized autosave, retry identity and stale-conflict recovery; legacy review stays isolated. No VPS.
  - Verify: project switching, edit-during-save, retry/no duplicate revision, retained conflict draft, auth/session changes; Web/backend build and regressions.
  - Verified: 6 Web workspace tests (including embedded PostgreSQL), embedded database/auth tests, Web/backend builds, semantic smoke and actual HTTP auth/MCP E2E. Native PostgreSQL multi-session coverage still requires local Docker; browser visual automation was not run.

- [x] WORK-003 — Goose SQL migrations for the reviewed V1 database model
  - Scope: versioned up/down SQL, existing foundation adoption, migration CLI, SQL round-trip tests and local guide; no VPS or new workflow APIs.
  - Verify: up/down/up, preservation of existing project state, constraints/immutable history and current application regressions.

  - Verified: Goose v3.28.0 CLI validate; SQL up/down/up, exact legacy adoption with preserved snapshots, atomic rollback refusal, checkpoint uniqueness and evidence byte/immutability tests; Web tests/backend build. Native pg and real Goose database round-trip tests are opt-in and not run here.
