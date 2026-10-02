# Current Work

## Active



## Done
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

- [x] WORK-014 | feat: classic IDE layout and cursor-first Ladder input | 2026-10-01 | feature | → owner: docs/designs/ladder-wire-editing.md
  - Delivered: white fixed-cell Ladder sheet, compact menus/toolbar and program navigation; optional properties. F5/F6/F7/F8 input, Enter/double-click editing, Overwrite/Insert, continued cursor and Shift-arrow ranges. Existing wire, clipboard and Compile behavior retained.
  - Verified: 40 Web tests and production build; Chromium local/PGlite cursor scenarios and full earlier editor/clipboard/Compile/export regression passed; desktop/narrow screenshots inspected. Working prototype; full vendor keyboard/branch/monitor parity and real Windows IDE acceptance remain outside this slice.

- [x] WORK-013 | feat: range clipboard and explicit compile diagnostics | 2026-10-01 | feature | → owner: docs/designs/ladder-wire-editing.md
  - Delivered: atomic rectangular clipboard preserving cells/branches and identities, collision/partial-span rejection, revision-bound Compile with clickable errors/history, stale export protection, retained adapter bytes and idempotent requests. SamSoar explicitly identifies its intermediate CSV limitation.
  - Verified: 40 Web tests; persistence 8 pass/2 native skipped; Web/backend builds, semantic smoke and HTTP E2E. Chromium local/PGlite copy/cut/paste/one-step Undo, collision, Compile PASS/stale/FAIL navigation, GX download and durable history reload passed. Native Windows IDE opening remains unverified; roadmap tasks retain Partial status.


Older records: [October work archive](docs/task-archive/2026-10.md).
