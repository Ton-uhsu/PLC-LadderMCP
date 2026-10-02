# Current Work

## Active


## Done
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

- [x] WORK-016 | fix: open wire drawing and reversible vertical junctions | 2026-10-02 | fix | → owner: docs/designs/ladder-wire-editing.md
  - Delivered: Ctrl+Up/Down draws only a vertical leg, Right extends an open L, and the return join is explicit. Traversing an existing vertical segment deletes only that junction; traversing its gap reconnects it. Horizontal segments, nested legs and symbol identities survive; incomplete drafts persist and block Compile/Export. Local project name changes reset stale cursor state.
  - Verified: 44 Web tests, including four open-branch regressions and the nested user-image reproduction; Web/backend builds, semantic smoke/HTTP E2E, persistence 8 pass/2 native skipped. Chromium local/PGlite drawing, reverse-delete/reconnect, explicit join, Compile gate, saved reload and Undo passed alongside cursor/clipboard/export regressions; dark screenshots inspected.
  - Handoff: update both server and Web for optional series draft-junction fields; no SQL migration. Arbitrary non-structured graph connections remain unsupported. No real Windows IDE/native database claim.

- [x] WORK-015 | fix: restore original dark editor theme | 2026-10-02 | fix | → owner: docs/designs/ladder-wire-editing.md
  - Delivered: original dark canvas/chrome/symbol palette restored; new menu, program tree and input modal match it. Cursor/input/clipboard/Compile behavior unchanged.
  - Verified: Web production build and full Chromium editor workflow passed in local/PGlite modes; dark desktop, dialog and narrow captures inspected. No schema or requirement changes.

Older records: [October work archive](docs/task-archive/2026-10.md).
