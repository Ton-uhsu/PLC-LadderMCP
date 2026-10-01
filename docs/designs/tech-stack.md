# PLC-LadderMCP Tech Stack

**Document:** `docs/designs/tech-stack.md`  
**Status:** Accepted V1 Architecture Baseline  
**Version:** 1.0  
**Research baseline:** 2026-10-01  
**Requirement baseline:** `docs/01-requirements.md` Version 1.0

## 1. Goal

PLC-LadderMCP is an AI-first PLC Ladder authoring, review, validation, import/export, and versioning system.

The canonical source of truth is **Ladder IR**. The Web UI, MCP tools, validator, Human Review, diff engine, compiler, and vendor adapters must operate around the same canonical representation.

This document defines the V1 technology baseline after the Requirements Freeze. It supersedes the earlier MVP assumptions that filesystem JSON was sufficient, PostgreSQL was optional, or the frontend could remain on GitHub Pages for the V1 production architecture.

---

## 2. Selected V1 Stack

| Layer | V1 technology | Role |
| --- | --- | --- |
| Runtime | Node.js 24 LTS | Backend/MCP JavaScript runtime |
| Language | TypeScript 6 | Shared types across Web, backend, IR, validator, adapters, and tools |
| Package manager | npm 11 workspaces | Existing monorepo dependency/workspace management |
| Web UI | React 19.3 | Human control center and Ladder editing/review UI |
| Web build | Vite 8.x | Development server and production build |
| Styling | Tailwind CSS 4.3 | Application UI styling |
| Local/editor state | Zustand | Selection, local editor state, transient UI state |
| Server/API state | TanStack Query v5 | Backend data fetching, cache, invalidation, and refetch |
| Ladder renderer | React + SVG | Deterministic Ladder visualization from canonical IR |
| Runtime schemas | Zod 4 | Boundary validation for IR, MCP, API, import, and persisted records |
| HTTP backend | Fastify 5 | REST/auth/health/application HTTP boundary |
| MCP SDK | MCP TypeScript SDK v2 | AI-facing MCP server implementation |
| MCP HTTP integration | `@modelcontextprotocol/fastify` | Official Fastify integration for MCP Streamable HTTP |
| MCP transport | Streamable HTTP | Primary remote MCP transport |
| Database | PostgreSQL 18.6 | Durable projects, revisions, review state, compile/export history, POC evidence |
| SQL access | Kysely + `pg` | Type-safe SQL/query layer without a heavy active-record ORM |
| Evidence API | PostgREST 16 | Requirement-driven PostgreSQL/PostgREST path for POC/evidence data |
| Unit/integration tests | Vitest 5 | TypeScript/Node/Web package testing |
| Browser E2E | Playwright | Human Review, Compile, Export, auth, and critical browser flows |
| Logging | Pino | Structured backend logs |
| Containers | Docker BuildKit / Buildx | Reproducible application images |
| Registry | GitHub Container Registry (GHCR) | V1 application image registry |
| CI/CD | Jenkins | Build, test, image publication, and Kubernetes deployment |
| Kubernetes | kubeadm + Kubernetes 1.36.x | Primary V1 runtime on the single-node VPS |
| CNI / service networking | Cilium 1.20.x | Cluster networking and Gateway API implementation |
| North-south routing | Kubernetes Gateway API 1.6.1 via Cilium | Public HTTP/HTTPS routing |
| TLS | cert-manager + Let's Encrypt | Automated certificate issuance/renewal |

Exact patch versions should be pinned in lockfiles, container images, and deployment manifests. This document intentionally treats most application libraries as a major/minor baseline so documentation does not become stale after every patch release.

---

## 3. Why These Choices Fit PLC-LadderMCP

### 3.1 Node.js 24 LTS + TypeScript 6

Node.js 24 is the selected V1 production runtime because it is an LTS line at the time of this design baseline.

TypeScript 6 is selected because the project depends heavily on shared domain types and the MCP TypeScript SDK v2 supports the modern TypeScript toolchain.

The project remains ESM-first.

### 3.2 npm 11 workspaces stays

The repository already uses npm workspaces successfully.

Changing to pnpm or another package manager is not required for V1 because it would add migration work without solving a current product requirement.

### 3.3 Fastify 5 as the backend framework

Fastify becomes the application HTTP foundation for:

- `/health`
- `/auth/*`
- `/api/*`
- `/mcp`
- request authentication/authorization boundaries
- schema-aware HTTP handling
- structured logging integration

Fastify was selected over a heavier framework because the Ladder domain logic already lives in shared packages/services and does not require a large application framework container.

### 3.4 MCP TypeScript SDK v2

The previous monolithic `@modelcontextprotocol/sdk` v1 dependency is no longer the target architecture.

V1 design targets the split MCP SDK v2 packages, especially:

```text
@modelcontextprotocol/server
@modelcontextprotocol/fastify
@modelcontextprotocol/node
```

Remote MCP uses Streamable HTTP through the Fastify integration.

MCP remains an interface to the Ladder Engine, not the source of business logic.

---

## 4. Proposed Repository Boundaries

```text
apps/
└── web/                           React + Vite + Tailwind

packages/
├── ladder-ir/                     canonical IR + Zod 4 schemas
├── ladder-validator/              semantic/device/topology validation
├── ladder-renderer/               React + SVG Ladder rendering
├── ladder-diff/                   topology-aware before/after diff
├── plc-capabilities/              data-driven PLC model profiles
├── gxworks2-adapter/              GX Works2 parser/serializer
└── samsoar-adapter/               SamSoar2022 parser/serializer

services/
└── mcp-server/                    Fastify application + MCP + human API/auth

infra/
├── docker/                        image definitions/build support
├── jenkins/                       pipeline definitions/helpers
└── kubernetes/                    manifests / overlays / deployment config
```

The exact package split may evolve during implementation, but these boundaries are architectural:

- vendor adapters do not own canonical Ladder semantics;
- the Web UI does not directly edit vendor files;
- MCP handlers do not contain vendor serializers;
- persistence is accessed through backend/domain services rather than directly from React components.

---

## 5. Core Data Flow

```text
                              AI Client
                                 │
                     Authenticated MCP / HTTPS
                                 ▼
                         Fastify + MCP v2
                                 │
                                 ▼
                        Semantic Batch Layer
                                 │
                 ┌───────────────┴────────────────┐
                 │                                │
                 ▼                                ▼
        Canonical Ladder Engine            Human API / Review
                 │                                │
                 └───────────────┬────────────────┘
                                 ▼
                           Ladder IR
             ┌───────────────────┼───────────────────┐
             │                   │                   │
             ▼                   ▼                   ▼
       SVG Renderer          Validator            Diff
             │                   │                   │
             └───────────────────┴───────────────────┘
                                 │
                                 ▼
                              Compile
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
             GX Works2 Adapter         SamSoar Adapter
                    │                         │
                    ▼                         ▼
               Export Artifact          Export Artifact
                                 │
                                 ▼
                            PostgreSQL
```

A vendor export file is an artifact of a specific project revision. It is not the authoritative project state.

---

## 6. Frontend Architecture

### 6.1 React 19.3 + Vite 8 + Tailwind 4.3

The V1 Web application is the control center required by the product requirements.

It is responsible for:

- project selection and metadata
- network navigation
- structured manual Ladder editing
- deterministic Ladder preview
- explicit Compile action
- diagnostic navigation
- AI Change / Human Review
- before/after Ladder diff
- approval/rejection and rejection feedback
- version/compile/export history
- import/export workflows

It is not intended to become a complete replacement for GX Works2 or SamSoar2022.

### 6.2 State separation

Use **Zustand** only for local/transient editor state such as:

- selected project/network/node
- panel state
- preview preferences
- local edit interaction state
- undo/redo session state where appropriate

Use **TanStack Query** for backend-owned state such as:

- project records and revisions
- Human Review batches
- proposal status
- compile history
- export history/artifacts
- import/POC results

Do not duplicate authoritative backend entities permanently inside a large Zustand store.

---

## 7. Ladder Renderer

Use React + SVG.

SVG remains the preferred rendering model because Ladder is a deterministic structured technical diagram requiring explicit geometry for:

- power rails
- horizontal and vertical conductors
- NO / NC contacts
- coils
- SET / RST
- timers and counters
- instruction/function blocks
- series/parallel/nested branches
- diff highlighting and review overlays

Rendering consumes Ladder IR directly.

```text
Ladder IR
    │
    ▼
layout calculation
    │
    ▼
SVG scene
    │
    ▼
Ladder Preview / Diff / Human Review
```

The renderer must not depend on screenshots from GX Works2 or SamSoar2022.

---

## 8. Ladder IR and Validation

Canonical Ladder IR uses TypeScript types plus Zod 4 runtime schemas.

Schema validation and PLC semantic validation remain separate concerns:

```text
MCP / REST / import / persisted data
                │
                ▼
             Zod 4
                │
                ▼
       Structurally valid IR
                │
                ▼
        Ladder Validator
                │
                ▼
 PLC-model semantic diagnostics
```

The validator consumes data-driven PLC capability profiles and produces stable machine-readable diagnostic codes.

Manual edits run the full validator through explicit **Compile**. AI proposal and integration validation run automatically at the safety gates defined by the requirements.

---

## 9. Backend and MCP Architecture

### 9.1 Fastify application boundary

The backend is one deployable Node.js service in V1, with internal modules separated by responsibility.

Conceptual route ownership:

```text
GET/POST /auth/*    human authentication/session boundary
/api/*              human Web API
/mcp                 authenticated MCP Streamable HTTP
/health              health/readiness surface
```

The service may remain a modular monolith in V1. There is no requirement to split Ladder, auth, review, and export into separate microservices.

### 9.2 Semantic AI write path

AI-facing writes use the semantic-batch contract from REQ-137 through REQ-158.

The preferred shape is conceptually:

```text
AI reads consistent project snapshot
            │
            ▼
propose semantic batch
(projectId, baseRevision, operations, dependencies)
            │
            ▼
transactional proposal construction
            │
            ▼
validation
            │
            ▼
Human Review
            │
            ▼
integration validation
            │
            ▼
Apply
```

AI tools do not directly mutate authoritative saved project state.

### 9.3 Remote MCP authentication

Remote `/mcp` access requires authentication under REQ-159.

V1 may use the existing single-admin machine token model. Token format/rotation can evolve later without changing the Ladder Engine contract.

---

## 10. Persistence

PostgreSQL is mandatory in V1.

The previous filesystem-only persistence model is retained only as a local development/debug compatibility aid during migration. It is not the V1 production source of truth.

### 10.1 PostgreSQL responsibilities

PostgreSQL should persist at least the durable data required by the frozen requirements, including:

- projects
- project revisions / Ladder IR snapshots or revision payloads
- AI change batches and proposal revisions
- per-network review state
- rejection feedback
- validation/integration results or references
- compile runs and diagnostics
- export versions/events and target metadata
- retained export artifacts
- POC fixtures
- POC runs and compatibility evidence
- audit history required by the AI change lifecycle

### 10.2 SQL access

Application business logic uses **Kysely + `pg`**.

Reasons:

- strongly typed TypeScript queries;
- SQL remains visible and predictable;
- good fit for audit/version/history tables;
- avoids coupling domain objects to a heavy ORM lifecycle.

### 10.3 PostgREST boundary

PostgREST 16 is included because REQ-091 through REQ-094 explicitly require POC/evidence data through the PostgreSQL/PostgREST path.

PostgREST does **not** replace the Fastify application backend. Domain operations such as semantic batches, Human Review, Compile, Apply, and Export stay behind the application service.

---

## 11. Vendor Adapters

Vendor adapters translate between canonical Ladder IR/instruction structures and supported IDE interchange formats.

Initial targets remain:

- GX Works2
- SamSoar2022

The adapters are responsible for:

- parsing supported import formats;
- preserving source mapping where practical;
- compiling canonical topology into target instruction representations;
- adapter compatibility checks before Export;
- safe passthrough of supported preserved vendor-specific nodes;
- serializing exact vendor interchange output.

Round-trip support remains evidence-driven through real IDE fixtures.

---

## 12. Testing Stack

### 12.1 Vitest 5

Use Vitest for:

- Ladder IR schema tests
- validator tests
- capability-profile tests
- compiler tests
- adapter parser/serializer tests
- semantic-batch/domain service tests
- Fastify API integration tests where browser execution is not required

### 12.2 Playwright

Use Playwright for critical browser workflows:

- human login/session flow
- manual Ladder edit and Compile
- diagnostics navigation
- Human Review approve/reject
- rejection feedback/rework
- export target selection and export history
- import workflows

### 12.3 Fixture-driven adapter testing

```text
tests/
└── fixtures/
    ├── gxworks2/
    └── samsoar2022/
```

Each supported Ladder feature should progressively obtain:

1. canonical IR fixture;
2. expected logical instruction representation;
3. expected vendor serialization;
4. parser/round-trip test where supported;
5. real IDE compatibility evidence.

---

## 13. Logging and Observability

Use **Pino** structured JSON logs from Fastify/backend processes.

At minimum, logs should make it possible to correlate:

- request ID
- project ID
- batch ID / batch revision
- compile run ID
- export event ID
- diagnostic code

Do not log authentication secrets, raw passwords, or bearer tokens.

Metrics/tracing stacks such as Prometheus/Grafana/OpenTelemetry are not mandatory V1 requirements and may be added when operational needs justify them.

---

## 14. Deployment Technology

The V1 production path is:

```text
GitHub
   │
   ▼
Jenkins
   │
   ├── npm install / build / test
   ├── Docker Buildx
   └── push images
   ▼
GHCR
   │
   ▼
Kubernetes 1.36.x (single-node kubeadm VPS)
   │
   ├── Web
   ├── Fastify + MCP backend
   ├── PostgreSQL 18.6
   └── PostgREST 16
   │
   ▼
Cilium 1.20.x + Gateway API 1.6.1
   │
   ▼
cert-manager + Let's Encrypt
   │
   ▼
Real-domain HTTPS
```

Both frontend and backend run on Kubernetes in V1. GitHub Pages is not the primary production deployment target.

Jenkins runs outside the Kubernetes cluster on the same VPS as required by the V1 requirements.

---

## 15. Upgrade / Migration Work From the Current Repository

The repository currently predates this accepted stack in several places.

Implementation work will need to include:

1. migrate from TypeScript 5.x to TypeScript 6;
2. migrate Zod 3 to Zod 4;
3. migrate MCP SDK v1 `@modelcontextprotocol/sdk` to MCP SDK v2 split packages;
4. introduce Fastify 5 as the HTTP composition boundary;
5. separate Zustand local/editor state from TanStack Query server state;
6. move durable production state from filesystem/in-memory storage to PostgreSQL;
7. add Kysely/`pg` persistence modules;
8. add PostgREST for POC/evidence access;
9. add Vitest 5 and Playwright test layers;
10. create Docker/Jenkins/GHCR/Kubernetes deployment assets;
11. replace GitHub Pages/reverse-proxy production assumptions with the Kubernetes/Gateway API design.

These are implementation migrations, not changes to the frozen V1 product requirements.

---

## 16. Decisions Intentionally Deferred

The following remain design/implementation decisions unless a requirement later fixes them:

- UI component library
- exact PostgreSQL table layout
- exact artifact binary storage representation inside PostgreSQL
- exact staging/production namespace/topology details
- advanced observability stack
- external identity provider
- multi-user RBAC
- collaborative editing
- direct PLC communication
- PLC online write/download
- proprietary project-binary editing

---

## 17. Research References

The 2026-10-01 stack refresh was checked against primary project documentation, including:

- Node.js release/LTS information: https://nodejs.org/en/about/previous-releases
- TypeScript 6 release notes: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html
- MCP TypeScript SDK v2: https://ts.sdk.modelcontextprotocol.io/v2/
- MCP Fastify serving guide: https://ts.sdk.modelcontextprotocol.io/v2/serving/fastify.html
- Fastify v5 docs: https://fastify.dev/docs/latest/
- React 19.3: https://react.dev/blog/2026/09/09/react-19-3
- Vite 8: https://vite.dev/blog/announcing-vite8
- Tailwind CSS 4.3: https://tailwindcss.com/blog/tailwindcss-v4-3
- PostgreSQL 18.6: https://www.postgresql.org/docs/release/18.6/
- PostgREST 16: https://postgrest.org/en/stable/
- Vitest 5: https://vitest.dev/blog/vitest-5
- Kubernetes 1.36: https://kubernetes.io/releases/1.36/
- Cilium Gateway API: https://docs.cilium.io/en/stable/network/servicemesh/gateway-api/gateway-api/

---

## 18. Current Decision

The accepted V1 stack is:

```text
Node.js 24 LTS + TypeScript 6 + npm 11 workspaces
│
├── React 19.3 + Vite 8 + Tailwind 4.3
├── Zustand + TanStack Query v5
├── React + SVG Ladder Renderer
├── Zod 4
├── Fastify 5
├── MCP TypeScript SDK v2 + Fastify adapter
├── Ladder IR / Validator / Diff / Compiler
├── GX Works2 Adapter
├── SamSoar2022 Adapter
├── PostgreSQL 18.6 + Kysely + pg
├── PostgREST 16 for POC/evidence path
├── Vitest 5 + Playwright
├── Pino
└── Jenkins -> Docker Buildx -> GHCR -> kubeadm Kubernetes 1.36.x
    └── Cilium 1.20.x + Gateway API + cert-manager
```

The primary architectural rule remains:

> **Ladder IR is the source of truth. AI, Web, validation, review, compilation, persistence, and vendor export must converge on the same canonical project semantics.**
