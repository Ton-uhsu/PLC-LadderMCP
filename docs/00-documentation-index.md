# Documentation Index

PLC-LadderMCP documentation is organized by canonical ownership.

## Core
- `01-requirements.md` — accepted V1 requirements freeze (REQ-001 through REQ-159).
- `03-solution-design.md` — V1 architecture overview and design index.
- `02-project-roadmap.md` — to be derived after the V1 solution design is finalized enough to sequence implementation work.

## Detailed design documents
- `designs/tech-stack.md` — accepted V1 technology baseline and migration direction.
- `designs/deployment-architecture.md` — Jenkins/GHCR/kubeadm Kubernetes/Gateway API production topology.
- `designs/authentication-access-control.md` — human versus machine authentication boundaries.

- [`designs/persistence-database-architecture.md`](./designs/persistence-database-architecture.md) — V1 PostgreSQL model, immutable revisions, review lifecycle, compile/export traceability, and evidence storage.

## Contracts, research, and evidence
- `contracts/fx3u-capability-catalog.md`
- `research/plc-ide-import-export.md`
- `evidence/fx3u-verification-matrix.md`

## Canonical ownership rules
- Product behavior and scope belong in `01-requirements.md`.
- Architecture and implementation choices belong in `03-solution-design.md` and `designs/*`.
- Vendor/PLC capability contracts belong in `contracts/*`.
- Format investigation belongs in `research/*`.
- Real IDE verification results belong in `evidence/*`.
- The roadmap must be derived from the accepted requirements and solution design rather than becoming a second source of product requirements.

## Local development guides
- [`guides/local-postgresql-persistence.md`](./guides/local-postgresql-persistence.md) — local database setup, revision API and verification.
