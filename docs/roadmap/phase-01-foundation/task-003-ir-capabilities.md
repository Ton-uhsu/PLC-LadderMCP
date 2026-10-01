# TASK-003 — IR, FX3U capabilities และ shared engine

**Status:** Partial
**Requirements:** REQ-001, REQ-005–015, REQ-018–021, REQ-095–111
**Dependencies:** ไม่มี
**Assessment date:** 2026-10-01

## Scope

เติมช่องว่าง IR/typed operands/stable IDs/source mapping/schema-version readers, PLC capability profiles และ shared validator/compiler ตาม canonical designs

## Current evidence and limits

IR v0.2, FX3U compiler/validator/catalog และ fixtures มีแล้วรวมใน ladder-ir. Package separation และความครบถ้วนตาม V1 ยังต้องตรวจ; support ต้องจำกัดตาม opcode/operand ที่มีหลักฐาน.

Implementation anchors: `packages/ladder-ir; docs/contracts/fx3u-capability-catalog.md`. Repository baseline: `88b376703e69d26d5b545af7515fb5bb0cca8661`. Historical execution records are in [TASKS.md](../../../TASKS.md); architecture ownership stays in [solution design](../../03-solution-design.md).

## Completion checks

These checks operationalize the referenced frozen requirements; they do not add product scope. For Partial/Planned tasks, boxes remain unchecked until task-specific verification is recorded.

- [ ] nested series/parallel รักษาลำดับและ identity
- [ ] operands/profile constraints ตรวจได้
- [ ] schema ที่ไม่รองรับไม่ถูกทิ้งเงียบ
- [ ] round trip ไม่อ้างความสามารถเกิน fixture

## Verification / handoff

Verify the relevant unit/domain/UI/HTTP behavior and race/error paths, then record dated evidence here or link the owning Test/evidence artifact. Real IDE compatibility requires real IDE evidence; generated output or schema existence alone is insufficient. Before source changes, use spec-architect readiness and open a WORK entry linking this task. Resolve contract details against canonical design before implementing; do not use illustrative UI fixture data as saved/compiled/applied state.

[Phase index](./README.md) · [Project roadmap](../../02-project-roadmap.md)
