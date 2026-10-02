# Current Work

## Active


## Done
- [x] WORK-026 | fix: embed account controls in the sidebar footer | 2026-10-02 | fix | → owner: docs/designs/authentication-access-control.md
  - Delivered: admin/Sign out uses normal sidebar footer layout, with no floating chip. Hidden-sidebar screens use an in-flow page footer. AuthGate shares the existing user/logout through context; session behavior remains intact.
  - Verified: production build and full Chromium local/PGlite regression, sidebar bounds/static positioning, one visible Sign out, mobile footer below status bar and successful logout. Desktop/narrow screenshots inspected.
  - Handoff: Web-only update and browser refresh; no backend/schema migration.

- [x] WORK-025 | fix: dismiss compile results and move the session chip to bottom left | 2026-10-02 | fix | → owner: docs/designs/ladder-wire-editing.md
  - Delivered: Close/Escape hides compile diagnostics and red highlights, returns canvas focus and retains selection/report/export validation. View reopens results; a new run opens automatically. A bounded panel keeps Close visible while scrolling. Request errors are dismissible; admin/Sign out sits at bottom left on desktop and narrow screens.
  - Verified: 66 Web tests, production build and Chromium local/PGlite close/reopen/Escape/selection/report retention/request-error dismissal, 84-error scrolling/immediate wire edit/new-run reopening, desktop/narrow session coordinates and prior editor/export/persistence regressions. Screenshots inspected.
  - Handoff: Web-only update and browser refresh; no backend/schema migration.

- [x] WORK-024 | fix: extend Right past the branch return without shifting its leg or coil | 2026-10-02 | fix | → owner: docs/designs/ladder-wire-editing.md
  - Delivered: Ctrl+Right at a closed return creates one external draft cell; branch width, existing left stroke, vertical return and output coordinates stay fixed. Continuation and reverse deletion remain one cell each.
  - Verified: 66 Web tests, Web/backend builds, semantic smoke, embedded persistence 8 pass/2 native skipped, and Chromium local/PGlite fixed-return/fixed-coil/right-stroke/Undo/Redo/saved-reload acceptance plus prior regressions. Screenshots inspected.
  - Handoff: update both Web and backend for the optional rightExtension draft count; compiler version fx3u-v02-6, no SQL migration. Unresolved extensions block Compile/Export.

- [x] WORK-023 | fix: symmetric Ctrl-left/right erasure and one cursor highlight | 2026-10-02 | fix | → owner: docs/designs/ladder-wire-editing.md
  - Delivered: normal/open rows edit the same traversed horizontal interval in both directions. One cursor overlay replaces old node/empty-container/focus highlights; the real cursor position remains authoritative at the sheet edge.
  - Verified: 63 Web tests and production build; Chromium local/PGlite immediate horizontal reverse deletion, one computed highlight, ordinary arrows, Undo/Redo and saved reload, plus prior editor regressions. Cursor screenshot inspected.
  - Handoff: update/restart Web and refresh the browser; no schema migration.

- [x] WORK-022 | fix: limit every Ctrl-arrow wire addition/deletion to one cell | 2026-10-02 | fix | → owner: docs/designs/ladder-wire-editing.md
  - Delivered: horizontal wires toggle to genuinely blank cells; skipped open-row columns remain blank. Tall vertical legs, shared nested strokes, reconnect and explicit joins edit one row interval with one-row cursor movement. Delete retains per-cell behavior.
  - Verified: 59 Web tests; Web/backend builds; semantic smoke; embedded persistence 8 pass/2 native skipped; Chromium local/PGlite four-direction one-cell checks, Undo, partial-junction saved reload and prior editor regressions.
  - Handoff: update both Web and backend for optional per-cell junction break offsets; compiler version fx3u-v02-5, no SQL migration.

- [x] WORK-021 | fix: Ctrl+Left on an open branch never fills its right tail | 2026-10-02 | fix | → owner: docs/designs/ladder-wire-editing.md
  - Delivered: open rows and their enclosing groups no longer inherit connected right padding from series expansion or output suffix alignment. Left draws only its addressed cell; the existing vertical junction and unrelated output position remain stable.
  - Verified: 52 Web tests and production build; full Chromium local/PGlite one-left-cell/no-right-tail/Undo/Redo/saved-reload regression plus prior editor checks. Correct left-facing L screenshot inspected.
  - Handoff: Web-only update, no schema migration; existing incomplete-draft Compile rules apply.

- [x] WORK-020 | fix: draw exactly one horizontal block per key press | 2026-10-02 | fix | → owner: docs/designs/ladder-wire-editing.md
  - Delivered: blank closed-branch allocations become erased disconnected cells before drawing, preventing inferred padding from connecting the remaining row. Ctrl+Left/Right moves one column and connects one cell, including the first cell; open continuation and unrelated geometry stay intact.
  - Verified: 51 Web tests and production build; full Chromium local/PGlite left/right/first-cell blank-tail/Undo acceptance and all prior cursor, drawing, clipboard, Delete, Compile/export and saved-reload regressions.
  - Handoff: Web-only update using the existing erased draft marker; no schema migration.

- [x] WORK-019 | fix: continuous horizontal drawing and a single cursor highlight | 2026-10-02 | fix | → owner: docs/designs/ladder-wire-editing.md
  - Delivered: open horizontal drafts extend left past their initial junction without moving it, and right beyond the old sheet with a spare cursor cell. One-cell selection uses only the main cursor; rectangular range overlay appears only for multiple cells.
  - Verified: 50 Web tests, Web/backend builds and semantic smoke; full Chromium local/PGlite left-past-junction/right-past-sheet continuation, one-highlight, Undo/Redo and saved reload, alongside all prior editor regressions. Dark continuation screenshot inspected.
  - Handoff: update server and Web for optional series wireOffset draft marker; compiler version fx3u-v02-4. Unresolved left extensions remain drafts and cannot be closed/exported as valid structured circuits; left rail/symbol protection stays in effect. No SQL migration.

- [x] WORK-018 | fix: Delete clears selected vertical wire segments | 2026-10-02 | fix | → owner: docs/designs/ladder-wire-editing.md
  - Delivered: cell Delete addresses actual left/right branch junctions, including vertical-only open rows. Drawing synchronizes cursor and cell selection; toolbar and keyboard Delete use the current cell after clearing. Stable rows, unrelated junctions/symbols and atomic Undo retained.
  - Verified: 49 Web tests and production build; full Chromium local/PGlite regressions plus immediate-drawing keyboard Delete, toolbar Delete, Undo and deleted-junction saved reload. Targeted tests cover upward endpoints, consecutive legs and right return boundaries.
  - Handoff: Web-only update; existing persisted break flags and server schema suffice. No SQL migration.

- [x] WORK-017 | fix: Delete clears cells without residual Gap symbols | 2026-10-02 | fix | → owner: docs/designs/ladder-wire-editing.md
  - Delivered: one Delete leaves blank cells, including legacy Gap nodes, without orange endpoints or wire stubs. Clearing a complete empty branch block removes its vertical legs; coordinates and cursor remain stable. Undo restores the edit; redraw and saved reload retain correct semantics.
  - Verified: 46 Web tests; Web/backend builds; full Chromium local/PGlite legacy-Gap, one-Delete, zero-glyph branch clearing, Undo and durable reload, alongside cursor/clipboard/open-branch/Compile/export regressions. Blank screenshot inspected.
  - Handoff: restart Web and server for the optional wire erased draft marker; no SQL migration. Blank paths still fail Compile.

Older records: [October work archive](docs/task-archive/2026-10.md).
