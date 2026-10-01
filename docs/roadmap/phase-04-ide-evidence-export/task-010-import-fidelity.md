# TASK-010 — GX Works2/SamSoar import และ fidelity diagnostics

**Status:** Partial
**Requirements:** REQ-002, REQ-004–005, REQ-015, REQ-043–044, REQ-080–090, REQ-110–111
**Dependencies:** TASK-003, TASK-004–005; evidence TASK-012
**Assessment date:** 2026-10-01

## Scope

verify formats ผ่าน POC; import canonical IR/metadata, unsupported-node preservation, lossy warnings/read-only diagnostic scope

## Current evidence and limits

GX Works2 List text parser/import UI มีแล้ว; full supported formats/fidelity ของทั้ง IDE ยัง Pending POC.

Implementation anchors: `packages/ladder-ir/src/gxworks2-import.ts; docs/research/plc-ide-import-export.md`. Repository baseline: `88b376703e69d26d5b545af7515fb5bb0cca8661`. Historical execution records are in [TASKS.md](../../../TASKS.md); architecture ownership stays in [solution design](../../03-solution-design.md).

## Completion checks

These checks operationalize the referenced frozen requirements; they do not add product scope. For Partial/Planned tasks, boxes remain unchecked until task-specific verification is recorded.

- [ ] no silent loss
- [ ] source mapping/version retained
- [ ] unsafe fidelity เป็น read-only affected scope
- [ ] imported logic เข้า review ตามเดิม
- [ ] import PASS ไม่เท่ากับ export/round-trip PASS

## Verification / handoff

Verify the relevant unit/domain/UI/HTTP behavior and race/error paths, then record dated evidence here or link the owning Test/evidence artifact. Real IDE compatibility requires real IDE evidence; generated output or schema existence alone is insufficient. Before source changes, use spec-architect readiness and open a WORK entry linking this task. Resolve contract details against canonical design before implementing; do not use illustrative UI fixture data as saved/compiled/applied state.

[Phase index](./README.md) · [Project roadmap](../../02-project-roadmap.md)
