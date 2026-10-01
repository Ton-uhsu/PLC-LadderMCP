# TASK-001 — Project/revision foundation

**Status:** Done
**Requirements:** REQ-016, REQ-023, REQ-033, REQ-040, REQ-041, REQ-095–097, REQ-111
**Dependencies:** ไม่มี
**Assessment date:** 2026-10-01

## Scope

Kysely + pg repository, human-authenticated create/list/read/save, immutable IR snapshots, optimistic baseRevision และ retry identity

## Current evidence and limits

API และ Web autosave มีแล้ว; embedded PostgreSQL และ workspace tests ผ่านตามบันทึก WORK-001/002. Done ครอบคลุม foundation นี้ ไม่ได้หมายถึง history/restore/AI persistence ครบ V1.

Implementation anchors: `services/mcp-server/src/persistence; apps/web/src/persistence; WORK-001/002`. Repository baseline: `88b376703e69d26d5b545af7515fb5bb0cca8661`. Historical execution records are in [TASKS.md](../../../TASKS.md); architecture ownership stays in [solution design](../../03-solution-design.md).

## Completion checks

These checks operationalize the referenced frozen requirements; they do not add product scope. For Partial/Planned tasks, boxes remain unchecked until task-specific verification is recorded.

- [x] สร้าง/อ่าน/บันทึกแยก UUID ได้
- [x] แก้ระหว่าง save แล้วไม่สูญหาย
- [x] request เดิมไม่สร้าง revision ซ้ำ
- [x] stale ไม่ overwrite
- [x] revision เก่าแก้/ลบไม่ได้

## Verification / handoff

Verify the relevant unit/domain/UI/HTTP behavior and race/error paths, then record dated evidence here or link the owning Test/evidence artifact. Real IDE compatibility requires real IDE evidence; generated output or schema existence alone is insufficient. Before source changes, use spec-architect readiness and open a WORK entry linking this task. Resolve contract details against canonical design before implementing; do not use illustrative UI fixture data as saved/compiled/applied state.

[Phase index](./README.md) · [Project roadmap](../../02-project-roadmap.md)
