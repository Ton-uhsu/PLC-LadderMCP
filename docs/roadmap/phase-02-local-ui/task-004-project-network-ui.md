# TASK-004 — Project และ network navigation/settings

**Status:** Partial
**Requirements:** REQ-003–006, REQ-010, REQ-036, REQ-041–042, REQ-146, REQ-148
**Dependencies:** TASK-001, TASK-003
**Assessment date:** 2026-10-01

## Scope

project picker, project settings/PLC context/default target, network add/delete/reorder/comment และ project-scoped navigation

## Current evidence and limits

มี picker/new project/network tabs; PostgreSQL picker ใช้ UUID. Settings button ยังไม่มี workflow; network management และ default target UI ยังไม่ครบ.

Implementation anchors: `apps/web/src/App.tsx; apps/web/src/store.ts`. Repository baseline: `88b376703e69d26d5b545af7515fb5bb0cca8661`. Historical execution records are in [TASKS.md](../../../TASKS.md); architecture ownership stays in [solution design](../../03-solution-design.md).

## Completion checks

These checks operationalize the referenced frozen requirements; they do not add product scope. For Partial/Planned tasks, boxes remain unchecked until task-specific verification is recorded.

- [ ] switch project แล้ว review/compile/history context ไม่ปะปน
- [ ] stable network ID ไม่เปลี่ยนเพราะ reorder
- [ ] PLC model แยกจาก export IDE
- [ ] errors/empty/loading states มีความหมาย

## Verification / handoff

Verify the relevant unit/domain/UI/HTTP behavior and race/error paths, then record dated evidence here or link the owning Test/evidence artifact. Real IDE compatibility requires real IDE evidence; generated output or schema existence alone is insufficient. Before source changes, use spec-architect readiness and open a WORK entry linking this task. Resolve contract details against canonical design before implementing; do not use illustrative UI fixture data as saved/compiled/applied state.

[Phase index](./README.md) · [Project roadmap](../../02-project-roadmap.md)
