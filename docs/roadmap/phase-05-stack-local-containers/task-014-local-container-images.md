# TASK-014 — Local images, database integration และ CI build assets

**Status:** Planned
**Requirements:** REQ-024–025, REQ-029–033
**Dependencies:** TEST-001, TASK-013; end-to-end workflows TASK-007–012
**Assessment date:** 2026-10-01

## Scope

Docker BuildKit/Buildx images/local composition, Web/backend/PG18.6/PostgREST16, health/shutdown/migrations, GHCR/Jenkins build/test/publish assets เตรียมบน repo

## Current evidence and limits

local PostgreSQL Compose มีแล้ว; application images/Jenkins/GHCR pipeline ยังไม่ยืนยันพร้อม.

Implementation anchors: `infra ตาม deployment design; compose.local.yaml ปัจจุบันมี PostgreSQL เท่านั้น`. Repository baseline: `88b376703e69d26d5b545af7515fb5bb0cca8661`. Historical execution records are in [TASKS.md](../../../TASKS.md); architecture ownership stays in [solution design](../../03-solution-design.md).

## Completion checks

These checks operationalize the referenced frozen requirements; they do not add product scope. For Partial/Planned tasks, boxes remain unchecked until task-specific verification is recorded.

- [ ] local containers รัน reviewed workflows/restart durability
- [ ] explicit Goose job ไม่ startup side effect
- [ ] no secrets baked into images
- [ ] reproducible image tags/digests
- [ ] CI assets ตรวจบน local ก่อนใช้ VPS

## Verification / handoff

Verify the relevant unit/domain/UI/HTTP behavior and race/error paths, then record dated evidence here or link the owning Test/evidence artifact. Real IDE compatibility requires real IDE evidence; generated output or schema existence alone is insufficient. Before source changes, use spec-architect readiness and open a WORK entry linking this task. Resolve contract details against canonical design before implementing; do not use illustrative UI fixture data as saved/compiled/applied state.

[Phase index](./README.md) · [Project roadmap](../../02-project-roadmap.md)
