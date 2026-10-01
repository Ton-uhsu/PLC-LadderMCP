# TASK-013 — Accepted V1 stack alignment

**Status:** Planned
**Requirements:** REQ-018–024, REQ-033, REQ-036–040, REQ-095–111, REQ-159
**Dependencies:** TASK-003; regressions ของ TASK-004–012 ต้องคงไว้
**Assessment date:** 2026-10-01

## Scope

Node24/npm11/TS6/Zod4, React19.3/Vite8/Tailwind4.3/Zustand/Queryv5, Fastify5/MCP SDKv2 + fastify integration/Streamable HTTP, Vitest5/Playwright/Pino และ package boundaries ตาม design

## Current evidence and limits

code ยัง TS5/Zod3/Vite6/MCP SDKv1 และ raw HTTP; shared modules ส่วนมากรวม ladder-ir; accepted stack ไม่ใช่ implementation ปัจจุบัน.

Implementation anchors: `docs/designs/tech-stack.md; package manifests/workspaces`. Repository baseline: `88b376703e69d26d5b545af7515fb5bb0cca8661`. Historical execution records are in [TASKS.md](../../../TASKS.md); architecture ownership stays in [solution design](../../03-solution-design.md).

## Completion checks

These checks operationalize the referenced frozen requirements; they do not add product scope. For Partial/Planned tasks, boxes remain unchecked until task-specific verification is recorded.

- [ ] pin compatible versions และ reproducible install/build
- [ ] retain auth/MCP/domain semantics
- [ ] typed frontend transport
- [ ] test behavior แทน implementation mirrors
- [ ] no new microservices/heavy ORM

## Verification / handoff

Verify the relevant unit/domain/UI/HTTP behavior and race/error paths, then record dated evidence here or link the owning Test/evidence artifact. Real IDE compatibility requires real IDE evidence; generated output or schema existence alone is insufficient. Before source changes, use spec-architect readiness and open a WORK entry linking this task. Resolve contract details against canonical design before implementing; do not use illustrative UI fixture data as saved/compiled/applied state.

[Phase index](./README.md) · [Project roadmap](../../02-project-roadmap.md)
