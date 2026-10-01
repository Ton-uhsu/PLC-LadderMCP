# TASK-016 — End-to-end V1 acceptance

**Status:** Planned
**Requirements:** REQ-001–159
**Dependencies:** TASK-001–015, TEST-001
**Assessment date:** 2026-10-01

## Scope

requirement-traceable acceptance across manual editor, authenticated AI/review/Apply, compile/export/history, POC และ deployed environment

## Current evidence and limits

existing smoke/auth E2E เป็น regression baseline; ยังไม่ใช่ full V1 acceptance.

Implementation anchors: `owning task acceptance + canonical designs/contracts/evidence`. Repository baseline: `88b376703e69d26d5b545af7515fb5bb0cca8661`. Historical execution records are in [TASKS.md](../../../TASKS.md); architecture ownership stays in [solution design](../../03-solution-design.md).

## Completion checks

These checks operationalize the referenced frozen requirements; they do not add product scope. For Partial/Planned tasks, boxes remain unchecked until task-specific verification is recorded.

- [ ] manual edit→autosave→Compile→adapter→retained artifact→real IDE
- [ ] AI snapshot→batch→per-network review→atomic Apply
- [ ] stale/retry/restart/auth races verified
- [ ] pending capabilities labelled
- [ ] staging/prod verification completed ก่อน release

## Verification / handoff

Verify the relevant unit/domain/UI/HTTP behavior and race/error paths, then record dated evidence here or link the owning Test/evidence artifact. Real IDE compatibility requires real IDE evidence; generated output or schema existence alone is insufficient. Before source changes, use spec-architect readiness and open a WORK entry linking this task. Resolve contract details against canonical design before implementing; do not use illustrative UI fixture data as saved/compiled/applied state.

[Phase index](./README.md) · [Project roadmap](../../02-project-roadmap.md)
