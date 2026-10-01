# TASK-005 — Structured manual editor และ Ladder renderer

**Status:** Partial
**Requirements:** REQ-006–009, REQ-015, REQ-037–040, REQ-042, REQ-045, REQ-052, REQ-095–110
**Dependencies:** TASK-003, TASK-004
**Assessment date:** 2026-10-01

## Scope

element selection/inspector, contacts/coils/timers/counters/instructions/branches, remove/order operations, actual nested Ladder rendering และ session undo/redo

## Current evidence and limits

Initial implementation 2026-10-01 (WORK-005): recursive Ladder SVG วาด series/parallel และ nested branches ตาม canonical IR รวม parallel outputs. เลือก leaf จากภาพด้วย mouse/keyboard หรือเลือก group จากรายการ elements; inspector แก้ contact mode/edge/device, OUT/SET/RST และ instruction opcode/typed device/decimal/hex operands. เพิ่ม timer/counter preset forms ตาม IR v0.2 เดิม, series/parallel groups, insert/remove/reorder/wrap โดยรักษา ID ของ node/action เดิมและไม่แก้ network อื่น.

ใช้ได้ทั้ง PostgreSQL และ legacy local ผ่าน human-only edit API; PostgreSQL autosave ทำ immutable revisions และ session Undo/Redo เดิม. Inspector เป็น buffered form: Update element เป็น structured editing operation แล้ว autosave โดยไม่ต้องกด Save project. กลุ่มว่าง/invalid drafts เก็บได้แต่ไม่ถือว่า Compile ผ่าน; ไม่มี drag-and-drop canvas scope ใหม่.

WORK-006 replaces the form-first view after user screenshot review: full-height dark Ladder workspace, multi-network canvas/gutter/grid, symbol toolbar, address/instruction entry, compact properties, zoom, keyboard Delete/Undo, and collapsed rung structure without visible UUIDs. Project/export and connection tools are opened on demand. Canvas width adapts to the viewport while preserving topology. Toolbar output insertion builds explicit parallel output branches; this is a semantic IR edit, not inferred from screen coordinates. Backend 404 save errors preserve state and explain updating/restarting the backend rather than silently using another write API.

WORK-007 adds reusable editor operations: session-only structured Copy/Cut/Paste (one element/subtree; root selection copies a complete network), Duplicate, right-click actions, buffered symbol dialog on Enter/double-click, branch-aware directional navigation/Home/End, selection scrolling, and Ctrl+F substring search across devices/instructions in all networks. Copy assigns fresh node/action IDs; same-project cut/paste retains absent IDs, while undo collisions or a different project allocate new IDs. Whole-network duplicate preserves its comment and inserts after the selected network with a fresh network ID. Clipboard edits use the existing human save/autosave path and session Undo/Redo. Cut of a whole network is disabled; Delete network remains the explicit operation. Clipboard is in-app and single-selection, not the operating-system clipboard or multi-range editing. Nested groups retain their tree semantics; drafts still require an explicit supported Compile.

WORK-008 adds Ctrl-arrow wire/branch edits with a canonical connected/gap node, stable identities, human autosave and Undo/Redo. Vertical shortcuts remove only empty/wire branches; occupied branches are guarded. Explicit gaps remain saved drafts and block Compile/Apply/Export. Compile normalizes connected wires temporarily and warns if they bypass all conditions. SamSoar now rejects unsupported nested conditions rather than omitting them. See [wire design](../../designs/ladder-wire-editing.md) for operation boundaries, reader compatibility and verification. Web/backend builds, 21 Web tests, persistence 7 pass/2 native skipped, smoke/HTTP E2E and local/PGlite browser wire/reload checks passed. No real IDE acceptance claim.

ยัง Partial: browser acceptance ของ canvas/editing slice ผ่านแล้ว (ดูด้านล่าง); real rendered Review diff/highlight ต้องต่อ TASK-008 และ explicit revision-bound Compile ต้อง TASK-007. Typed instruction families, timer time-base/retentive semantics, device comments/labels และ source-map completeness ยังอยู่ TASK-003. Opcode suggestions ไม่ใช่ compatibility certificate; current compiler ยังมี root/output topology limits และต้องรายงาน error แทนเปลี่ยนภาพหรือ IR ให้ตรง adapter.

Implementation anchors: `apps/web/src/editor/*; apps/web/src/persistence/ManualEditor.tsx; packages/ladder-ir/src/structured-edit.ts`. Repository baseline: `88b376703e69d26d5b545af7515fb5bb0cca8661`. Historical execution records are in [TASKS.md](../../../TASKS.md); architecture ownership stays in [solution design](../../03-solution-design.md).

## Completion checks

These checks operationalize the referenced frozen requirements; they do not add product scope. Check boxes only where task-specific verification is recorded; Partial retains the remaining acceptance scope.

- [x] edit operations เปลี่ยน canonical IR
- [x] nested topology ไม่ยุบเป็นภาพที่เปลี่ยนความหมาย
- [x] node identity stable
- [x] undo/redo และ autosave ไม่เท่ากับ Compile
- [x] ไม่มีข้อกำหนด drag-and-drop IDE ใหม่

## Verification / handoff

2026-10-01: `npm run web:test` 14/14 passed, including targeted nested edits/identity guards, recursive rendering/selection markup, hex round-trip, session Undo/Redo, incomplete draft autosave and reopen/historical reads through embedded PostgreSQL. `npm run db:test` 7 passed / 2 native suites skipped. Web/backend builds, IR fixture, semantic smoke and actual HTTP auth/MCP E2E passed. Static React SVGs for nested conditions and M0→six parallel outputs were rasterized and visually inspected; this verifies fixture rendering, not browser interactions or real IDE compatibility.

WORK-006 browser evidence, 2026-10-01: Chromium headless was obtained using temporary QA tooling (previous runtime download failure is resolved for this check). [Optional browser harness](../../../scripts/test-editor-browser.mjs) passed against both legacy local HTTP and PostgreSQL application mode backed by PGlite: login, project creation, toolbar NO/NC/output/timer input, canvas selection/properties save, branches, multiple networks, Undo/Redo, Delete/Ctrl+Z, zoom, PostgreSQL reload and old-backend 404 preserving current IR. Visually inspected 1600×1000, 1100×800 and 520×800 screenshots. Native PostgreSQL and real IDE coverage are not implied; TEST-001 remains separate. Full rendered Review diff and revision-bound Compile are still unimplemented dependencies.

WORK-007 verification, 2026-10-01: 18 Web tests passed; Web production build passed. Extended optional Chromium harness passed local and PGlite-backed HTTP application modes: copy/paste undo, cut/paste stable identity, right-click duplicate, whole-network duplicate/undo, Enter/double-click dialog, cancel without save, whitespace device rejection/normalization, instruction timer operand update, Ctrl+F selection in another network, horizontal/vertical branch navigation, autosave/reopen and old-backend retained failure state. Visually inspected desktop dialog and desktop/narrow workspace captures. This is editor workflow evidence, not real GX Works2/SamSoar compatibility or native PostgreSQL acceptance.

Local exercise: create a project; select root and append contact then coil; inspect device/mode, select a leaf and insert after it, move/remove, wrap a condition in parallel, select its empty branch and add contacts, edit timer/counter/instruction operands, Undo/Redo and reload. Verify SVG and element tree agree, keyboard selection works, narrow layouts scroll, errors preserve state and busy controls prevent overlapping edits. NC+edge drafts must fail the current compiler rather than silently lose inversion. Native persistence remains TEST-001. Real IDE compatibility requires real IDE evidence; generated output or schema existence alone is insufficient. Before source changes, use spec-architect readiness and open a WORK entry linking this task. Resolve contract details against canonical design before implementing; do not use illustrative UI fixture data as saved/compiled/applied state.

[Phase index](./README.md) · [Project roadmap](../../02-project-roadmap.md)
