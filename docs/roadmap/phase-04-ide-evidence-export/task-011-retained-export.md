# TASK-011 — Compile-gated export, versions และ retained artifacts

**Status:** Partial
**Requirements:** REQ-001–002, REQ-011, REQ-020, REQ-085–086, REQ-141–149
**Dependencies:** TASK-003, TASK-007, TEST-001; evidence TASK-012
**Assessment date:** 2026-10-01

## Scope

adapter gate, default/override IDE target, optional note, one version per exact revision, multiple export events/targets/files, actual retained-byte download/history

## Current evidence and limits

browser generates GX/SamSoar files ใน legacy path; database projects ปิด Export. Retained artifacts/version/event API และ revision Compile gate ยังไม่ทำ.

Implementation anchors: `apps/web export; vendor adapters; app.export_*`. Repository baseline: `88b376703e69d26d5b545af7515fb5bb0cca8661`. Historical execution records are in [TASKS.md](../../../TASKS.md); architecture ownership stays in [solution design](../../03-solution-design.md).

## Completion checks

These checks operationalize the referenced frozen requirements; they do not add product scope. For Partial/Planned tasks, boxes remain unchecked until task-specific verification is recorded.

- [ ] current successful Compile + exact-snapshot adapter gate
- [ ] unsupported scope identified
- [ ] same revision repeat export มี logical checkpoint เดียว
- [ ] bytes/BOM/encoding/target/revision ตรง
- [ ] failed export ไม่อ้าง success

## Verification / handoff

Verify the relevant unit/domain/UI/HTTP behavior and race/error paths, then record dated evidence here or link the owning Test/evidence artifact. Real IDE compatibility requires real IDE evidence; generated output or schema existence alone is insufficient. Before source changes, use spec-architect readiness and open a WORK entry linking this task. Resolve contract details against canonical design before implementing; do not use illustrative UI fixture data as saved/compiled/applied state.

[Phase index](./README.md) · [Project roadmap](../../02-project-roadmap.md)
