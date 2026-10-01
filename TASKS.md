# Current Work

## Active


## Done
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

- [x] WORK-006 | feat: canvas-first Ladder editor workspace | 2026-10-01 | feature | → owner: docs/roadmap/phase-02-local-ui/task-005-structured-editor-renderer.md
  - Delivered: dark multi-network canvas, toolbar entry, compact properties, grid/gutter/zoom, keyboard edits and secondary tools; no UUIDs in the normal editor view. Backend 404 gives update/restart guidance without mutating displayed IR.
  - Verified: 16 Web tests, Web/backend builds, smoke/HTTP E2E; optional browser harness passed local and PGlite application modes including save/reopen, properties, branch/network edits, Undo/Redo, keyboard and retained 404 failure state. Visual QA at 1600/1100/520px.
  - Handoff: TASK-005 remains Partial for full V1 typed IR/diff/Compile integration; native database gate remains TEST-001. No VPS work.

- [x] WORK-005 | feat: structured Ladder editor and topology renderer | 2026-10-01 | feature | → owner: docs/roadmap/phase-02-local-ui/task-005-structured-editor-renderer.md
  - Delivered: nested series/parallel SVG, element selection/inspector, stable-ID insert/remove/reorder/wrap, contact/output/timer/counter/instruction operands in both local and database modes. Fixed hex formatting and blocked unsupported NC-edge compilation; related gap evidence in TASK-003.
  - Verified: Web tests 14/14, persistence tests 7 pass/2 native skipped, Web/backend builds, IR fixture, smoke and HTTP E2E; visually inspected two rasterized React SVG fixtures.
  - Handoff: TASK-005 stays Partial for browser acceptance, typed V1 IR completion and rendered Review/Compile integration. No VPS or broad stack migration.


Older records: [October work archive](docs/task-archive/2026-10.md).
