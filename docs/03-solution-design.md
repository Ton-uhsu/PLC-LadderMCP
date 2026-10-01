# PLC-LadderMCP Solution Design

**Status:** Accepted V1 Architecture Overview / Design Index  
**Requirement baseline:** `docs/01-requirements.md` Version 1.0  
**Tech-stack baseline:** `docs/designs/tech-stack.md` Version 1.0

## System context

PLC-LadderMCP is an AI-first toolchain. AI clients call authenticated semantic MCP/tool operations against a shared Ladder engine. The canonical source of truth is Ladder IR; preview, validation, diff, Human Review, compile, persistence, and vendor export all operate around that same project model.

```text
User / Browser                          AI Client
      │                                    │
      │ HTTPS                              │ Authenticated MCP / HTTPS
      ▼                                    ▼
   Web UI                           Fastify + MCP SDK v2
      │                                    │
      └──────────────┬─────────────────────┘
                     ▼
             Application / Domain Layer
                     │
          ┌──────────┼──────────┐
          ▼          ▼          ▼
      Ladder IR   Validator    Diff
          │          │          │
          └──────────┼──────────┘
                     ▼
                   Compile
                     │
          ┌──────────┴──────────┐
          ▼                     ▼
   GX Works2 Adapter      SamSoar Adapter
          │                     │
          ▼                     ▼
     Export Artifact       Export Artifact
                     │
                     ▼
                PostgreSQL
```

## Repository boundaries

- `apps/web` — React/Vite human control center for structured editing, Compile, review, history, import, and export.
- `packages/ladder-ir` — canonical Ladder representation and Zod schemas.
- `packages/ladder-validator` — semantic/device/topology validation and stable diagnostics.
- `packages/ladder-renderer` — deterministic React/SVG rendering.
- `packages/ladder-diff` — topology-aware before/after change comparison.
- `packages/plc-capabilities` — data-driven PLC model capability profiles.
- vendor adapter packages — translate between Ladder IR/instruction representations and supported IDE interchange formats.
- `services/mcp-server` — Fastify application boundary containing MCP v2, human HTTP/auth routes, domain orchestration, and persistence access.
- `infra` — Docker, Jenkins, and Kubernetes deployment assets.

## Key architecture rules

- Ladder IR is the source of truth, not vendor CSV, screenshots, or an IDE-specific instruction list.
- Vendor-specific behavior stays outside the canonical IR where practical.
- AI-facing writes use semantic change batches and never directly mutate saved project state.
- AI proposal validation and pre-Apply integration validation are automatic safety gates.
- Manual structured edits autosave as draft state but require explicit Compile before Export.
- Human Web authentication and AI/MCP machine authentication remain separate boundaries.
- PostgreSQL is the durable V1 production persistence layer.
- PostgREST is used for the POC/evidence data path required by the frozen requirements, not as a replacement for Fastify domain APIs.
- Both Web and backend run on Kubernetes in the V1 production architecture.
- Public routing uses Kubernetes Gateway API through Cilium with cert-manager/Let's Encrypt TLS.
- Jenkins runs outside Kubernetes on the same VPS and deploys images from GHCR into the cluster.

## Primary runtime stack

```text
Node.js 24 LTS + TypeScript 6
├── Fastify 5
│   └── MCP TypeScript SDK v2 / Streamable HTTP
├── React 19.3 + Vite 8 + Tailwind 4.3
├── Zustand + TanStack Query v5
├── Zod 4
├── PostgreSQL 18.6 + Kysely + pg
├── PostgREST 16
├── Vitest 5 + Playwright
└── Pino
```

Production platform:

```text
Jenkins
   │
   ▼
Docker Buildx -> GHCR
   │
   ▼
kubeadm Kubernetes 1.36.x
   │
   ├── Web
   ├── Fastify/MCP backend
   ├── PostgreSQL
   └── PostgREST
   │
   ▼
Cilium 1.20.x + Gateway API 1.6.1
   │
   ▼
cert-manager + Let's Encrypt
```

## AI change lifecycle

```text
AI reads revision-pinned project snapshot
               │
               ▼
        Semantic change batch
               │
               ▼
 Transactional proposal construction
               │
               ▼
       Automatic validation
               │
        ┌───────┴────────┐
        │                │
      ERROR            valid
        │                │
        ▼                ▼
repair / failed      Human Review
                         │
                         ▼
                 approve/reject
                         │
                         ▼
               integration validation
                         │
                         ▼
                        Apply
```

This preserves the requirements for atomic semantic batches, per-network review, stale/base-revision protection, idempotency, and auditability.

## Manual edit / compile lifecycle

```text
Structured manual edit
        │
        ▼
   autosaved draft
        │
        ▼
 Compile Required
        │
 user presses Compile
        │
        ▼
 shared validator
        │
  PASS / FAIL + diagnostics
        │
        ▼
 Export eligible only when current revision passed
```

A logic-affecting edit after a successful Compile invalidates that Compile result.

## Persistence ownership

PostgreSQL owns durable production state including project revisions, AI batch/review lifecycle state, compile history, export versions/artifacts, POC fixtures/evidence, and required audit records.

Local filesystem JSON may remain temporarily for development/import compatibility while migration is in progress, but it is not the accepted V1 production source of truth.

## Detailed designs

- [`designs/tech-stack.md`](./designs/tech-stack.md) — accepted V1 technology stack, package direction, persistence, testing, and migration notes.
- [`designs/deployment-architecture.md`](./designs/deployment-architecture.md) — Kubernetes/Jenkins/GHCR/Gateway API production topology.
- [`designs/authentication-access-control.md`](./designs/authentication-access-control.md) — human versus machine authentication boundaries.

- [`designs/persistence-database-architecture.md`](./designs/persistence-database-architecture.md) — V1 PostgreSQL domain model, immutable revisions, Human Review, Apply transactions, compile/export lineage, and POC evidence.

## Contracts, research, and evidence

- [`contracts/fx3u-capability-catalog.md`](./contracts/fx3u-capability-catalog.md)
- [`research/plc-ide-import-export.md`](./research/plc-ide-import-export.md)
- [`evidence/fx3u-verification-matrix.md`](./evidence/fx3u-verification-matrix.md)

## Requirement ownership

Project requirements remain owned by [`01-requirements.md`](./01-requirements.md), which is frozen at V1.0 with REQ-001 through REQ-159.

Solution-design documents may refine implementation choices, schemas, package boundaries, and deployment details, but must not silently weaken or contradict the frozen requirements. If a true product requirement must change, update the requirements document explicitly before treating the new behavior as authoritative.
