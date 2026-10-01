# PLC-LadderMCP Deployment Architecture

**Document:** `docs/designs/deployment-architecture.md`  
**Status:** Accepted V1 Deployment Baseline  
**Version:** 1.0  
**Date:** 2026-10-01  
**Requirement baseline:** `docs/01-requirements.md` Version 1.0

## 1. Goal

Define the V1 production deployment model for PLC-LadderMCP after the Requirements Freeze.

The previous design that kept the frontend on GitHub Pages and ran only the backend on a VPS is superseded for V1 production. REQ-026 through REQ-033 require Kubernetes, Jenkins, GHCR, PostgreSQL, real-domain HTTPS, and both frontend/backend on Kubernetes.

The existing VPS remains the physical host, but it now runs the production platform rather than only a standalone Node.js process.

---

## 2. Selected Deployment Model

```text
                         GitHub
                            │
                            ▼
                  Jenkins (outside K8s)
                            │
                build / test / Docker Buildx
                            │
                            ▼
                           GHCR
                            │
                            ▼
               Single VPS / kubeadm cluster
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
          ▼                 ▼                 ▼
        Web Pod       Fastify/MCP Pod    PostgreSQL Pod
                               │                │
                               │                ├── durable app state
                               │                └── artifacts/evidence
                               │
                               └──────> PostgREST Pod
                            │
                            ▼
                 Cilium + Gateway API
                            │
                            ▼
                cert-manager / Let's Encrypt
                            │
                            ▼
                    Real-domain HTTPS
```

The developer's local computer is not required for normal V1 operation.

---

## 3. Physical Host and Kubernetes

The initial cluster uses a **single-node kubeadm Kubernetes 1.36.x cluster** on the project VPS.

This is intentionally not a managed Kubernetes service because the project also has a learning objective around standard Kubernetes components and operations.

The single-node topology is a V1 constraint, not a claim of high availability.

Expected host responsibilities:

```text
VPS host
├── Jenkins container/process outside Kubernetes
├── kubelet / kubeadm cluster components
├── container runtime
└── Kubernetes workloads
    ├── Web
    ├── Backend/MCP
    ├── PostgreSQL
    ├── PostgREST
    ├── Cilium
    └── cert-manager
```

The node must be configured so application workloads can be scheduled on the single control-plane node as appropriate for the lab/V1 environment.

---

## 4. Application Workloads

### 4.1 Web

The React/Vite application is built into a production container image and runs inside Kubernetes.

Responsibilities include:

- project navigation;
- structured Ladder editing;
- Compile/diagnostic UI;
- Human Review;
- history/import/export UI;
- authenticated calls to the backend.

GitHub Pages may still be used for demos or temporary development experiments, but it is not the V1 production frontend target.

### 4.2 Fastify / MCP backend

The backend container runs Node.js 24 LTS with Fastify 5 and MCP TypeScript SDK v2.

Public application surfaces include conceptually:

```text
/health
/auth/*
/api/*
/mcp
```

`/mcp` uses authenticated MCP Streamable HTTP.

The backend should remain horizontally scalable in its application design where practical, but V1 only requires the single-node deployment.

### 4.3 PostgreSQL

PostgreSQL 18.6 is the V1 durable database.

It stores the durable state required by the frozen requirements, including projects/revisions, Human Review lifecycle records, compile history, export history/artifacts, POC fixtures/evidence, and audit records.

Because the V1 requirements intentionally defer automated PostgreSQL backup scheduling, backup automation is not a release gate. Persistent storage is still required so normal pod restart/redeploy does not erase database contents.

### 4.4 PostgREST

PostgREST 16 runs as a separate workload connected to PostgreSQL for the POC/evidence path required by REQ-091 through REQ-094.

PostgREST is not the main application backend and must not bypass domain rules for Human Review, Compile, Apply, or Export.

---

## 5. Container Images and Registry

Application images are built using Docker BuildKit / Buildx and published to GHCR.

Expected images include at least:

```text
ghcr.io/<owner>/plc-ladder-mcp-web:<tag>
ghcr.io/<owner>/plc-ladder-mcp-server:<tag>
```

PostgreSQL, PostgREST, Cilium, and cert-manager should use official/upstream images or Helm charts rather than being rebuilt inside this repository unless a concrete customization is required.

Recommended image tags for project-owned components should include immutable Git SHA metadata so a deployment can be traced back to source.

---

## 6. Jenkins CI/CD

Jenkins remains outside the Kubernetes cluster on the same VPS as required by REQ-028.

Conceptual pipeline:

```text
GitHub push / approved release
        │
        ▼
      Jenkins
        │
        ├── npm ci
        ├── typecheck / lint where configured
        ├── Vitest
        ├── Playwright / appropriate E2E stage
        ├── build Web + backend
        ├── Docker Buildx
        ├── push GHCR
        └── deploy/update Kubernetes manifests
```

Production deployment credentials must live in Jenkins credentials and/or Kubernetes Secrets, not in repository plaintext.

The pipeline should deploy exact image references generated by the build rather than a mutable local image.

---

## 7. Kubernetes Networking

### 7.1 CNI

Use **Cilium 1.20.x** as the Kubernetes CNI/service-networking implementation.

### 7.2 Gateway API

Use **Kubernetes Gateway API 1.6.1 through Cilium** as the public north-south routing model.

This supersedes the earlier design suggestion to place a standalone Nginx/Caddy reverse proxy in front of a direct Node.js process.

Conceptual routing:

```text
Internet
   │
   ▼
Gateway
   │
   ├── /           -> Web Service
   ├── /api/*      -> Backend Service
   ├── /auth/*     -> Backend Service
   └── /mcp        -> Backend Service
```

A same-origin public design is preferred where practical because it reduces browser CORS complexity and gives the application one public TLS boundary.

If separate subdomains are later used, explicit CORS and cookie/session rules must be configured accordingly.

---

## 8. TLS and Domain

V1 uses a real domain and HTTPS.

Use **cert-manager** with **Let's Encrypt** to request and renew certificates at the Kubernetes Gateway boundary.

Conceptual flow:

```text
DNS
 │
 ▼
public application domain
 │
 ▼
Cilium Gateway / HTTPS listener
 │
 └── certificate managed by cert-manager
```

Application containers should normally receive internal cluster HTTP after TLS termination at the Gateway unless a later security design requires re-encryption.

---

## 9. Staging and Production

REQ-031 requires separate staging and production environments.

The initial single-cluster design should keep them logically isolated. The preferred V1 direction is separate Kubernetes namespaces, for example:

```text
plc-ladder-staging
plc-ladder-prod
```

This namespace choice remains a solution-design detail and may be refined before implementation, but staging and production must not share the same unqualified application state or database objects accidentally.

Each environment should have distinct:

- application configuration;
- secrets;
- database/storage identity;
- public hostname or route;
- deployed image reference;
- migration lifecycle.

---

## 10. Persistence and Storage

Filesystem paths inside application pods must not be treated as durable production storage.

PostgreSQL data requires Kubernetes-backed persistent storage appropriate to the single-node VPS.

The application may still write temporary generated files to ephemeral storage while processing import/export, but an export artifact that must be retained under the requirements must be committed to the PostgreSQL-backed durable artifact path before the operation is considered complete.

The old `.plc-ladder/*.json` persistence mechanism may remain during migration/local development but is not authoritative in V1 production.

---

## 11. Authentication and Secrets

Two logical authentication boundaries remain:

```text
Human browser -> Web session -> /api/*
AI/MCP client -> machine credential -> /mcp
```

Remote write-capable MCP is never anonymous.

Secrets should be injected through Kubernetes Secrets/Jenkins credentials and must not be baked into frontend bundles, container images, or Git history.

The V1 single-admin machine token remains acceptable under REQ-159.

---

## 12. Health and Deployment Safety

At minimum, workloads should expose health/readiness behavior sufficient for Kubernetes and Jenkins deployment verification.

Recommended checks include:

- Web HTTP response;
- backend `/health`;
- backend database connectivity/readiness where appropriate;
- PostgREST readiness;
- PostgreSQL pod readiness;
- Gateway route availability after deploy.

A deployment should fail visibly rather than being reported successful when the new backend cannot access its database or public route.

---

## 13. Environment Configuration

Environment-specific values should be injected at deployment time rather than compiled into shared application source.

Examples:

```text
APP_ENV
PUBLIC_APP_URL
DATABASE_URL
POSTGREST_* configuration
PLC_LADDER_TOKEN / machine credential
WEB session secret / admin credential
```

Public non-secret frontend configuration may be supplied through the build/deployment strategy selected for the Web image. Secrets must never be exposed to browser JavaScript.

---

## 14. Migration From the Legacy Deployment Design

The old architecture was:

```text
GitHub Pages -> VPS reverse proxy -> standalone Node.js server
                               └── filesystem/in-memory state
```

The accepted V1 migration is:

```text
Jenkins -> GHCR -> kubeadm Kubernetes
                   ├── Web
                   ├── Fastify/MCP backend
                   ├── PostgreSQL
                   └── PostgREST
                        │
                        ▼
              Cilium Gateway + TLS
```

Migration work should therefore remove production assumptions that:

- GitHub Pages is the main frontend host;
- the Node.js process is managed directly by systemd/PM2 for production;
- filesystem JSON is sufficient durable production state;
- PostgreSQL is optional;
- a standalone Nginx/Caddy proxy is the target routing architecture.

---

## 15. Decisions Still to Finalize

The following are not yet fully fixed by this document:

- exact Kubernetes storage class / host-path implementation for the single node;
- final staging-vs-production namespace and hostname naming;
- exact manifest strategy (plain YAML, Kustomize, Helm, or combination);
- exact database migration tool/workflow;
- resource requests/limits after measurement;
- optional observability stack.

These are implementation/design decisions, not reasons to revert to the superseded GitHub Pages deployment architecture.

---

## 16. Current Decision

```text
Host       : Existing VPS
Cluster    : kubeadm Kubernetes 1.36.x, single node
Frontend   : React/Vite container on Kubernetes
Backend    : Node.js 24 + Fastify 5 + MCP SDK v2 on Kubernetes
Database   : PostgreSQL 18.6 with persistent storage
Evidence   : PostgREST 16
Registry   : GHCR
CI/CD      : Jenkins outside Kubernetes on the same VPS
CNI        : Cilium 1.20.x
Routing    : Gateway API 1.6.1 via Cilium
TLS        : cert-manager + Let's Encrypt
Auth       : separate human session and authenticated machine MCP boundary
```

The key deployment rule is:

> **V1 production runs Web, backend, and PostgreSQL on the kubeadm cluster; Jenkins builds and deploys from outside the cluster; public access enters through a real-domain HTTPS Gateway.**
