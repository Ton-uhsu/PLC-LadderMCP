# TASK-009 — Revision history/restore และ auth/audit integration

**Status:** Partial
**Requirements:** REQ-016, REQ-022–023, REQ-033, REQ-039, REQ-062–079, REQ-111, REQ-136, REQ-159
**Dependencies:** TASK-001–002, TASK-007–008, TEST-001
**Assessment date:** 2026-10-01

## Scope

history browser/restore as new revision, local session undo distinct from restore; authenticated human/machine routes และ durable non-secret audit

## Current evidence and limits

human session/machine token separation และ session undo มีแล้ว; historical read API มีแล้ว. restore UI/API และ durable audit publication ยังขาด.

Implementation anchors: `apps/web history; services/mcp-server/src/auth; app.audit_events`. Repository baseline: `88b376703e69d26d5b545af7515fb5bb0cca8661`. Historical execution records are in [TASKS.md](../../../TASKS.md); architecture ownership stays in [solution design](../../03-solution-design.md).

## Completion checks

These checks operationalize the referenced frozen requirements; they do not add product scope. For Partial/Planned tasks, boxes remain unchecked until task-specific verification is recorded.

- [ ] restore ไม่ rewrite ประวัติ
- [ ] context แยกโปรเจกต์
- [ ] logout/restart ไม่เปิดทาง bypass
- [ ] no users/RBAC/password/session DB requirement
- [ ] audit ไม่บันทึก bearer tokens/secrets

## Verification / handoff

Verify the relevant unit/domain/UI/HTTP behavior and race/error paths, then record dated evidence here or link the owning Test/evidence artifact. Real IDE compatibility requires real IDE evidence; generated output or schema existence alone is insufficient. Before source changes, use spec-architect readiness and open a WORK entry linking this task. Resolve contract details against canonical design before implementing; do not use illustrative UI fixture data as saved/compiled/applied state.

[Phase index](./README.md) · [Project roadmap](../../02-project-roadmap.md)
