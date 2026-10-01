# TASK-008 — Semantic batch, per-network Human Review และ atomic Apply

**Status:** Partial
**Requirements:** REQ-014, REQ-017–018, REQ-021, REQ-044–079, REQ-137–140, REQ-150–159
**Dependencies:** TASK-001–003, TASK-005, TEST-001
**Assessment date:** 2026-10-01

## Scope

revision-pinned snapshot, ordered typed batch/dependencies/idempotency, validation/repair, proposal lineage, Ladder Before/After diff, review feedback, rework/locks, deferred/partial Apply, stale/cancel/retry

## Current evidence and limits

legacy semantic proposals/Human Review smoke มีแล้ว. UI ยังเป็น JSON diff/approve ทั้งรายการ; database projects ปิด review ไว้; schema อย่างเดียวไม่ทำให้ workflow ใช้ได้.

Implementation anchors: `services/mcp-server/src/project.ts/mcp.ts; apps/web AI review; SQL batch/review/apply tables`. Repository baseline: `88b376703e69d26d5b545af7515fb5bb0cca8661`. Historical execution records are in [TASKS.md](../../../TASKS.md); architecture ownership stays in [solution design](../../03-solution-design.md).

## Completion checks

These checks operationalize the referenced frozen requirements; they do not add product scope. For Partial/Planned tasks, boxes remain unchecked until task-specific verification is recorded.

- [ ] unknown operation reject ทั้ง batch
- [ ] whole-batch ERROR ไม่ approvable
- [ ] repair สูงสุด 3 attempts
- [ ] per-network decisions pin exact revision
- [ ] approved content locked
- [ ] review round จบก่อน Apply
- [ ] integration check + head/revision/audit atomic
- [ ] AI bypass ไม่ได้

## Verification / handoff

Verify the relevant unit/domain/UI/HTTP behavior and race/error paths, then record dated evidence here or link the owning Test/evidence artifact. Real IDE compatibility requires real IDE evidence; generated output or schema existence alone is insufficient. Before source changes, use spec-architect readiness and open a WORK entry linking this task. Resolve contract details against canonical design before implementing; do not use illustrative UI fixture data as saved/compiled/applied state.

[Phase index](./README.md) · [Project roadmap](../../02-project-roadmap.md)
