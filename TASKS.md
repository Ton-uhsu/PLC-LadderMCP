# Current Work

## Active

## Done
- [x] WORK-012 | feat: rectangular multi-cell selection and batch delete | 2026-10-01 | feature | → owner: docs/designs/ladder-wire-editing.md
  - Delivered: mouse-drag rectangular selection and Shift-click extension within one network, range highlight/count, Escape cancellation, and one-transaction Delete for symbols and wire segments. Unsupported multi-cell insert/clipboard actions are disabled.
  - Verified: 29 Web tests and production build passed. Isolated localhost browser QA passed Shift-click (4 cells), mouse drag (3 cells), range highlight/count and Escape; batch Delete, projected-wire gaps, unrelated-network preservation and no-op history behavior have unit coverage. The optional Playwright harness was extended but not executed because Playwright is not installed locally.

- [x] WORK-011 | fix: draw directional ladder wires without gap branches | 2026-10-01 | bug | → owner: docs/designs/ladder-wire-editing.md
  - Delivered: Ctrl-arrow drawing only connects segments; vertical drawing moves to the destination row and creates a connected row past the top/bottom edge. New rows can continue horizontally without Gap placeholders.
  - Verified: 25 Web tests and Web production build passed. Isolated localhost browser QA passed down/right/down/right/up/left drawing with three rows, zero disconnected gaps and zero UI errors; the optional Playwright harness was updated but not executed because Playwright is not installed locally.

- [x] WORK-010 | fix: load root .env when starting the local server | 2026-10-01 | bug | → owner: docs/guides/local-postgresql-persistence.md
  - Delivered: `npm run server` loads the repository-root `.env` when present, without overriding variables already set in the shell; no runtime dependency added.
  - Verified: before change invalid login returned 503 with Web auth disabled; after change the same launch loaded `.env` and returned 401. Explicit shell credential overrides logged in with HTTP 200. Backend build, semantic smoke and HTTP/MCP E2E passed.

- [x] WORK-009 | fix: fixed-column Ladder grid and output wire editing | 2026-10-01 | fix | → owner: docs/roadmap/phase-02-local-ui/task-005-structured-editor-renderer.md
  - Delivered: fixed 120px columns/88px rows; one wire/contact per cell, aligned ruler, cell cursor/arrow navigation and Ctrl-arrow segment editing. Coil-side wires and output placeholders preserve existing outputs; completed branches compile/export without dropping actions.
  - Verified: 24 Web tests, Web/backend builds, original IR fixture, semantic smoke and HTTP E2E; persistence 7 pass/2 native skipped. Chromium local/PGlite modes passed exact ruler/cell geometry, coil branch fill, occupied-cell protection, Undo/Redo and saved gap reload; desktop/narrow captures inspected.
  - Handoff: rebuild/restart Web and backend together. Structured tree positions are projected to the grid; arbitrary floating connections remain unsupported. TASK-005 stays Partial for typed V1 IR/Review/revision-bound Compile; no VPS or real IDE/native database claim.

- [x] WORK-008 | feat: Ctrl-arrow Ladder wire editing | 2026-10-01 | feature | → owner: docs/roadmap/phase-02-local-ui/task-005-structured-editor-renderer.md
  - Delivered: horizontal connected/gap toggles, vertical empty branch add/remove, canonical wire snapshots and Undo/Redo. Occupied branches/output symbols are protected. Compile rejects gaps; connected bypass semantics are explicit. SamSoar rejects unsupported nested conditions instead of dropping them.
  - Verified: 21 Web tests, Web/backend builds, persistence 7 pass/2 native skipped, original IR fixture, semantic smoke and HTTP E2E (node --import tsx workaround for CLI pipe permissions). Browser local/PGlite modes passed all Ctrl directions, undo/redo and saved gap reload; screenshots inspected.
  - Handoff: upgrade Web/backend together; design in docs/designs/ladder-wire-editing.md. TASK-005 stays Partial for full typed IR/Review/revision-bound Compile; no VPS or real IDE/native database claim.

- [x] WORK-007 | feat: practical Ladder editing commands | 2026-10-01 | feature | → owner: docs/roadmap/phase-02-local-ui/task-005-structured-editor-renderer.md
  - Delivered: structured clipboard and duplicate, whole-network copy, right-click actions, buffered symbol dialog, keyboard branch/network navigation, scrolling and device/instruction search. Human canonical IR save path; no VPS.
  - Verified: 18 Web tests, Web build; optional Chromium QA passed local and PGlite modes including cut identity, copy/duplicate undo, dialog cancel/validation/operand update, branch navigation, search, saved reload and retained backend errors. Visual QA desktop/narrow workspace and dialog.
  - Handoff: single-selection in-app clipboard; whole-network cut disabled. TASK-005 remains Partial for V1 typed semantics, rendered Review and revision-bound Compile; native gate stays TEST-001.

Older records: [October work archive](docs/task-archive/2026-10.md).
