# TASK-004 — Project และ network navigation/settings

**Status:** Partial
**Requirements:** REQ-003–006, REQ-010, REQ-036, REQ-041–042, REQ-146, REQ-148
**Dependencies:** TASK-001, TASK-003
**Assessment date:** 2026-10-01

## Scope

project picker, project settings/PLC context/default target, network add/delete/reorder/comment และ project-scoped navigation

## Current evidence and limits

Implemented 2026-10-01: Project settings แก้ชื่อและแสดง PLC context แบบ read-only; default export target แยกจาก PLC model และ autosave/Undo/Redo ใน PostgreSQL. Network controls เพิ่ม/ลบ/ย้าย/comment โดย array order เป็น execution order และไม่ renumber ID. ป้องกันการลบ network สุดท้ายและแสดง error/loading controls.

Legacy local development ใช้ human-only manual-save endpoint ตรวจ base snapshot ก่อนบันทึกและสร้าง session history; machine token เขียน endpoint นี้ไม่ได้. PostgreSQL ยังคงใช้ revision-bound save API เดิม. ปิด default-target persistence ใน legacy และแสดงเหตุผล. การ create/load/import ใน legacy มี busy guard และไม่รับผลจาก server/session เดิม.

WORK-006 tested the new multi-network canvas, network labels and backend errors in browser; settings/default-target browser acceptance remains pending.

ยัง Partial: ต้องยืนยัน project-scoped Review/Compile/history หลัง durable workflow integration. Database mode ไม่ใช้ legacy review/export; session Undo/Redo แยกจาก historical restore. ไม่ถือ UI settings เป็นการทำ export workflow เสร็จ.

Implementation anchors: `apps/web/src/projects/*; apps/web/src/persistence/workspace.ts; apps/web/src/store.ts; packages/ladder-ir/src/network-edit.ts; services/mcp-server/src/server.ts`. Repository baseline: `88b376703e69d26d5b545af7515fb5bb0cca8661`. Historical execution records are in [TASKS.md](../../../TASKS.md); architecture ownership stays in [solution design](../../03-solution-design.md).

## Completion checks

These checks operationalize the referenced frozen requirements; they do not add product scope. Check boxes only where task-specific verification is recorded; unchecked boxes retain the remaining acceptance scope.

- [ ] switch project แล้ว review/compile/history context ไม่ปะปน
- [x] stable network ID ไม่เปลี่ยนเพราะ reorder
- [x] PLC model แยกจาก export IDE
- [ ] errors/empty/loading states มีความหมาย

## Verification / handoff

2026-10-01 verification: `npm run web:test` 9/9 passed (network identity/order/delete boundaries, autosave races, defaults/undo and reopened PostgreSQL state); `npm run db:test` 7 passed, 2 native suites skipped; Web/backend builds, semantic smoke and actual HTTP auth/MCP E2E passed. HTTP checks include human manual save, machine-token rejection and stale-base 409. WORK-004 browser automation was blocked by Chromium download. WORK-006 subsequently obtained QA tooling and verified the canvas/network slice; that does not retroactively prove all settings/default-target checks. Native PostgreSQL/Goose verification remains [TEST-001](../phase-01-foundation/test-001-native-postgresql/README.md).

Local UI check pending: sign in, create two projects, rename, add/reorder/comment/delete a network, undo/redo, switch projects and reload; with PostgreSQL verify different project defaults persist and export override leaves PLC model unchanged. Check narrow viewport, error and busy states. Project-scoped durable Review/Compile acceptance must be completed with TASK-007/008/009. Real IDE compatibility requires real IDE evidence; generated output or schema existence alone is insufficient. Before source changes, use spec-architect readiness and open a WORK entry linking this task. Resolve contract details against canonical design before implementing; do not use illustrative UI fixture data as saved/compiled/applied state.

[Phase index](./README.md) · [Project roadmap](../../02-project-roadmap.md)
