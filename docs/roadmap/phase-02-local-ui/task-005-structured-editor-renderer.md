# TASK-005 — Structured manual editor และ Ladder renderer

**Status:** Partial
**Requirements:** REQ-006–009, REQ-015, REQ-037–040, REQ-042, REQ-045, REQ-052, REQ-095–110
**Dependencies:** TASK-003, TASK-004
**Assessment date:** 2026-10-01

## Scope

element selection/inspector, contacts/coils/timers/counters/instructions/branches, remove/order operations, actual nested Ladder rendering และ session undo/redo

## Current evidence and limits

มี basic editor สำหรับ database project: comment/contact/action device, add NO/coil; legacy UI ยังไม่แสดง editor นี้. Nested preview บางกรณีใช้ NESTED CONDITION ไม่ใช่ branch rendering จริง.

Implementation anchors: `apps/web/src/persistence/ManualEditor.tsx; apps/web/src/App.tsx`. Repository baseline: `88b376703e69d26d5b545af7515fb5bb0cca8661`. Historical execution records are in [TASKS.md](../../../TASKS.md); architecture ownership stays in [solution design](../../03-solution-design.md).

## Completion checks

These checks operationalize the referenced frozen requirements; they do not add product scope. For Partial/Planned tasks, boxes remain unchecked until task-specific verification is recorded.

- [ ] edit operations เปลี่ยน canonical IR
- [ ] nested topology ไม่ยุบเป็นภาพที่เปลี่ยนความหมาย
- [ ] node identity stable
- [ ] undo/redo และ autosave ไม่เท่ากับ Compile
- [ ] ไม่มีข้อกำหนด drag-and-drop IDE ใหม่

## Verification / handoff

Verify the relevant unit/domain/UI/HTTP behavior and race/error paths, then record dated evidence here or link the owning Test/evidence artifact. Real IDE compatibility requires real IDE evidence; generated output or schema existence alone is insufficient. Before source changes, use spec-architect readiness and open a WORK entry linking this task. Resolve contract details against canonical design before implementing; do not use illustrative UI fixture data as saved/compiled/applied state.

[Phase index](./README.md) · [Project roadmap](../../02-project-roadmap.md)
