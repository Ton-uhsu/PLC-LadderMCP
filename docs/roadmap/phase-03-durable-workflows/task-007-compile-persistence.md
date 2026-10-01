# TASK-007 — Revision-pinned Compile API และ history

**Status:** Partial
**Requirements:** REQ-011–012, REQ-038, REQ-112–136, REQ-149
**Dependencies:** TASK-001–003, TEST-001; UI TASK-006
**Assessment date:** 2026-10-01

## Scope

shared validator Compile run/diagnostics บน exact saved revision, completion races และ eligibility derivation

## Current evidence and limits

SQL tables/view มีแล้ว; ไม่มี durable Compile orchestration.

Implementation anchors: `services/mcp-server domain/repositories; validation_runs/compile_runs`. Repository baseline: `88b376703e69d26d5b545af7515fb5bb0cca8661`. Historical execution records are in [TASKS.md](../../../TASKS.md); architecture ownership stays in [solution design](../../03-solution-design.md).

## Completion checks

These checks operationalize the referenced frozen requirements; they do not add product scope. For Partial/Planned tasks, boxes remain unchecked until task-specific verification is recorded.

- [ ] ทุก explicit Compile มี run
- [x] later save ไม่เปลี่ยน input
- [x] historical PASS ไม่ยืนยัน head ใหม่
- [ ] metadata reuse เฉพาะเงื่อนไขใน persistence design
- [x] logic generation เปลี่ยนต้อง Compile ใหม่

## Verification / handoff

Verify the relevant unit/domain/UI/HTTP behavior and race/error paths, then record dated evidence here or link the owning Test/evidence artifact. Real IDE compatibility requires real IDE evidence; generated output or schema existence alone is insufficient. Before source changes, use spec-architect readiness and open a WORK entry linking this task. Resolve contract details against canonical design before implementing; do not use illustrative UI fixture data as saved/compiled/applied state.

[Phase index](./README.md) · [Project roadmap](../../02-project-roadmap.md)

## WORK-013 evidence update — 2026-10-01

Shared explicit Compile API, saved-revision pinning, durable run/diagnostic/audit rows, history reload, canvas navigation/highlight and current/stale UI are implemented. Exact-revision export gates reject historical passes for newer heads. Unit/SQL and browser checks passed in local/PGlite modes; see [wire/editor design](../../designs/ladder-wire-editing.md#work-013--rectangular-clipboard-and-explicit-compile-2026-10-01) for evidence and limits. Native PostgreSQL/Goose, complete V1 typed semantics, metadata-equivalence reuse and crash/interruption recovery remain open, so this task stays Partial.
