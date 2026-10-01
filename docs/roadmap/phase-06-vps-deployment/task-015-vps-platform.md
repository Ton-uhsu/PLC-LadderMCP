# TASK-015 — Jenkins/GHCR/kubeadm production platform

**Status:** Planned
**Requirements:** REQ-024–032, REQ-034–035, REQ-159
**Dependencies:** TASK-014; user readiness for VPS
**Assessment date:** 2026-10-01

## Scope

Jenkins Docker outside cluster; kubeadm K8s1.36/Cilium1.20/Gateway API/cert-manager TLS; Web/backend/PG/PostgREST; staging/production isolation, storage/secrets/migration jobs

## Current evidence and limits

target architecture accepted; storage implementation/naming/manifest strategy/resource sizing ยังต้องเลือก. deployment design บางข้อยังเขียน migration tool undecided แต่ Goose ถูกเลือกและ implement แล้วใน guide/tech-stack.

Implementation anchors: `docs/designs/deployment-architecture.md; docs/designs/authentication-access-control.md`. Repository baseline: `88b376703e69d26d5b545af7515fb5bb0cca8661`. Historical execution records are in [TASKS.md](../../../TASKS.md); architecture ownership stays in [solution design](../../03-solution-design.md).

## Completion checks

These checks operationalize the referenced frozen requirements; they do not add product scope. For Partial/Planned tasks, boxes remain unchecked until task-specific verification is recorded.

- [ ] build→GHCR→deploy auditably
- [ ] real domain HTTPS human/machine auth
- [ ] isolated staging/prod data/secrets
- [ ] persistent state after redeploy
- [ ] no quota/user SaaS/scheduled-backup feature added under REQ034/035

## Verification / handoff

Verify the relevant unit/domain/UI/HTTP behavior and race/error paths, then record dated evidence here or link the owning Test/evidence artifact. Real IDE compatibility requires real IDE evidence; generated output or schema existence alone is insufficient. Before source changes, use spec-architect readiness and open a WORK entry linking this task. Resolve contract details against canonical design before implementing; do not use illustrative UI fixture data as saved/compiled/applied state.

[Phase index](./README.md) · [Project roadmap](../../02-project-roadmap.md)
