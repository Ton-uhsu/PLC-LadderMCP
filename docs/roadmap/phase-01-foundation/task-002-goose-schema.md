# TASK-002 — Goose domain schema

**Status:** Done
**Requirements:** REQ-033, REQ-046–079, REQ-089–094, REQ-136, REQ-141–158
**Dependencies:** TASK-001
**Assessment date:** 2026-10-01

## Scope

SQL migration 4 ชุด, Up/Down, รับช่วง Kysely foundation เดิม และ CLI guide

## Current evidence and limits

มี 27 domain tables และ compile diagnostics view. Goose validate และ embedded SQL up/down/up ผ่าน; native CLI database execution ยังไม่ผ่านการรัน. Done หมายถึง schema delivery ไม่ใช่ domain workflow delivery.

Implementation anchors: `db/migrations; scripts/goose.mjs; scripts/adopt-kysely.mjs; WORK-003`. Repository baseline: `88b376703e69d26d5b545af7515fb5bb0cca8661`. Historical execution records are in [TASKS.md](../../../TASKS.md); architecture ownership stays in [solution design](../../03-solution-design.md).

## Completion checks

These checks operationalize the referenced frozen requirements; they do not add product scope. For Partial/Planned tasks, boxes remain unchecked until task-specific verification is recorded.

- [x] Up/Down มี dependency order
- [x] adoption รักษา snapshot
- [x] drift ปฏิเสธโดย rollback
- [x] Down ที่เสีย provenance ต้องล้มทั้ง transaction

## Verification / handoff

Verify the relevant unit/domain/UI/HTTP behavior and race/error paths, then record dated evidence here or link the owning Test/evidence artifact. Real IDE compatibility requires real IDE evidence; generated output or schema existence alone is insufficient. Before source changes, use spec-architect readiness and open a WORK entry linking this task. Resolve contract details against canonical design before implementing; do not use illustrative UI fixture data as saved/compiled/applied state.

[Phase index](./README.md) · [Project roadmap](../../02-project-roadmap.md)
