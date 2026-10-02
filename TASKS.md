# Current Work

## Active


## Done
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
