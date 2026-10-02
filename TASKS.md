# Current Work

## Active

None.

## Done
- [x] WORK-015 | fix: restore original dark editor theme | 2026-10-02 | fix | → owner: docs/designs/ladder-wire-editing.md
  - Delivered: original dark canvas/chrome/symbol palette restored; new menu, program tree and input modal match it. Cursor/input/clipboard/Compile behavior unchanged.
  - Verified: Web production build and full Chromium editor workflow passed in local/PGlite modes; dark desktop, dialog and narrow captures inspected. No schema or requirement changes.

- [x] WORK-014 | feat: classic IDE layout and cursor-first Ladder input | 2026-10-01 | feature | → owner: docs/designs/ladder-wire-editing.md
  - Delivered: white fixed-cell Ladder sheet, compact menus/toolbar and program navigation; optional properties. F5/F6/F7/F8 input, Enter/double-click editing, Overwrite/Insert, continued cursor and Shift-arrow ranges. Existing wire, clipboard and Compile behavior retained.
  - Verified: 40 Web tests and production build; Chromium local/PGlite cursor scenarios and full earlier editor/clipboard/Compile/export regression passed; desktop/narrow screenshots inspected. Working prototype; full vendor keyboard/branch/monitor parity and real Windows IDE acceptance remain outside this slice.

- [x] WORK-013 | feat: range clipboard and explicit compile diagnostics | 2026-10-01 | feature | → owner: docs/designs/ladder-wire-editing.md
  - Delivered: atomic rectangular clipboard preserving cells/branches and identities, collision/partial-span rejection, revision-bound Compile with clickable errors/history, stale export protection, retained adapter bytes and idempotent requests. SamSoar explicitly identifies its intermediate CSV limitation.
  - Verified: 40 Web tests; persistence 8 pass/2 native skipped; Web/backend builds, semantic smoke and HTTP E2E. Chromium local/PGlite copy/cut/paste/one-step Undo, collision, Compile PASS/stale/FAIL navigation, GX download and durable history reload passed. Native Windows IDE opening remains unverified; roadmap tasks retain Partial status.

- [x] WORK-012 | feat: rectangular multi-cell selection and batch delete | 2026-10-01 | feature | → owner: docs/designs/ladder-wire-editing.md
  - Delivered: mouse-drag rectangular selection and Shift-click extension within one network, range highlight/count, Escape cancellation, and one-transaction Delete for symbols and wire segments. Unsupported multi-cell insert/clipboard actions are disabled.
  - Verified: 29 Web tests and production build passed. Isolated localhost browser QA passed Shift-click (4 cells), mouse drag (3 cells), range highlight/count and Escape; batch Delete, projected-wire gaps, unrelated-network preservation and no-op history behavior have unit coverage. The optional Playwright harness was extended but not executed because Playwright is not installed locally.

- [x] WORK-011 | fix: draw directional ladder wires without gap branches | 2026-10-01 | bug | → owner: docs/designs/ladder-wire-editing.md
  - Delivered: Ctrl-arrow drawing only connects segments; vertical drawing moves to the destination row and creates a connected row past the top/bottom edge. New rows can continue horizontally without Gap placeholders.
  - Verified: 25 Web tests and Web production build passed. Isolated localhost browser QA passed down/right/down/right/up/left drawing with three rows, zero disconnected gaps and zero UI errors; the optional Playwright harness was updated but not executed because Playwright is not installed locally.

Older records: [October work archive](docs/task-archive/2026-10.md).
