# Phase 01 — Foundation และฐานข้อมูล

**Status:** Partial
**Assessment date:** 2026-10-01

ฐาน IR/SQL พร้อมบางส่วน; native PostgreSQL/Goose ยังรอทดสอบ

## Dependency / exit gate

ก่อนใช้ workflow ที่เขียน durable state ต้องผ่าน TEST-001

## Task index

| Owner | Current status | Dependencies |
| --- | --- | --- |
| [TASK-001: Project/revision foundation](./task-001-project-revisions.md) | Done | ไม่มี |
| [TASK-002: Goose domain schema](./task-002-goose-schema.md) | Done | TASK-001 |
| [TASK-003: IR, FX3U capabilities และ shared engine](./task-003-ir-capabilities.md) | Partial | ไม่มี |
| [TEST-001: Native PostgreSQL and Goose](./test-001-native-postgresql/README.md) | Not run | TASK-001–002 |

Task files own scope, checks and evidence; this index is a navigation/status summary. Phase order is sequencing, not a claim that every earlier task is complete.

[Project roadmap](../../02-project-roadmap.md)
