# TASK-006 — Compile และ diagnostic navigation UI

**Status:** Planned
**Requirements:** REQ-011–012, REQ-038, REQ-040, REQ-112–136, REQ-149
**Dependencies:** TASK-005; completion ต้อง TASK-007
**Assessment date:** 2026-10-01

## Scope

explicit Compile, Compile Required/Passed/Failed, severity summary/code/location, click to network/node และ compile-run history

## Current evidence and limits

ปุ่ม Validate ปัจจุบันแสดง browser validation ผ่าน alert และตรวจด้วย useMemo ทุกการเปลี่ยน project; ยังไม่มี revision-pinned successful Compile UX.

Implementation anchors: `apps/web/src/App.tsx; shared validator`. Repository baseline: `88b376703e69d26d5b545af7515fb5bb0cca8661`. Historical execution records are in [TASKS.md](../../../TASKS.md); architecture ownership stays in [solution design](../../03-solution-design.md).

## Completion checks

These checks operationalize the referenced frozen requirements; they do not add product scope. For Partial/Planned tasks, boxes remain unchecked until task-specific verification is recorded.

- [ ] logic edit ทำผลเดิม stale
- [ ] ERROR/WARNING/INFO แยก
- [ ] warning ไม่ block โดยอัตโนมัติ
- [ ] diagnostic นำทางได้
- [ ] unavailable API ไม่แสดง fake success
- [ ] browser check ไม่แอบใช้เป็น export gate

## Verification / handoff

Verify the relevant unit/domain/UI/HTTP behavior and race/error paths, then record dated evidence here or link the owning Test/evidence artifact. Real IDE compatibility requires real IDE evidence; generated output or schema existence alone is insufficient. Before source changes, use spec-architect readiness and open a WORK entry linking this task. Resolve contract details against canonical design before implementing; do not use illustrative UI fixture data as saved/compiled/applied state.

[Phase index](./README.md) · [Project roadmap](../../02-project-roadmap.md)
