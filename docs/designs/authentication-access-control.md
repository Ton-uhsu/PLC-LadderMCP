# PLC-LadderMCP Authentication & Access Control

**Document:** `docs/designs/authentication-access-control.md`  
**Status:** Accepted V1 Security Baseline  
**Version:** 1.0  
**Date:** 2026-10-01  
**Requirement baseline:** `docs/01-requirements.md` Version 1.0

## 1. Goal

Define the minimum V1 authentication boundary for the production Kubernetes deployment while keeping human Web access separate from AI/MCP machine access.

V1 remains a single-admin system. User registration, password reset, multi-user RBAC, and external identity providers are not required for V1.

REQ-159 requires authenticated remote MCP access for protected project data and project-affecting operations.

---

## 2. Authentication Boundaries

There are two different credential types and they must not be shared.

```text
Human browser
    │
    │ username + password
    ▼
POST /auth/login
    │
    ▼
short-lived Web session
    │
    └──> /api/*

AI / MCP client
    │
    │ machine credential
    ▼
/mcp
```

Rules:

- the browser never receives or needs the MCP machine credential;
- `/api/*` is the human-facing control surface;
- `/mcp` is the AI/tool surface and requires machine authentication;
- anonymous write-capable MCP access is forbidden;
- Human Review approval/rejection remains a human API/UI action and is not exposed as an unrestricted AI write tool;
- backend/domain services remain responsible for authorization boundaries rather than trusting frontend hiding/disabled buttons.

---

## 3. Public Route Model

Preferred same-origin production routing:

```text
https://plc.example.com/
├── /             Web application
├── /auth/*       human authentication
├── /api/*        human application API
└── /mcp          authenticated MCP Streamable HTTP
```

The public HTTPS listener is provided through Cilium Gateway API and cert-manager/Let's Encrypt as defined in the deployment architecture.

A same-origin layout is preferred because it simplifies browser session and CORS behavior.

If the implementation later uses separate frontend/API subdomains, explicit allowed origins and cookie/session configuration must be added; wildcard CORS must not be used for authenticated project APIs.

---

## 4. V1 Human Authentication

The V1 browser path uses one administrator credential and a short-lived session.

Conceptually:

```text
POST /auth/login
    │
    ├── verify configured admin credential
    ▼
issue signed short-lived session
    │
    ▼
/api/*
```

V1 does not require a database-backed user directory because REQ-022 fixes the first release as single-admin/personal use.

The admin password/secret must still be supplied as a deployment secret rather than committed to Git or embedded into a frontend bundle.

A default session duration such as eight hours may be used initially, but the exact timeout remains configuration rather than a product-level requirement.

---

## 5. V1 MCP Authentication

Remote `/mcp` access requires a machine credential.

The current `PLC_LADDER_TOKEN` concept remains acceptable for V1 and maps directly to REQ-159's single-admin token/API-credential allowance.

Conceptual request:

```http
Authorization: Bearer <machine-token>
```

The exact token format, expiry, and rotation workflow may evolve, but the following V1 rules are fixed:

- remote protected MCP operations require authentication;
- invalid/missing machine credentials are rejected;
- the token is never exposed to browser JavaScript;
- the token is not committed to the repository;
- the backend must validate the token before MCP handlers can read protected project data or submit a semantic change batch;
- authentication does not bypass semantic-batch validation, Human Review, stale checks, or Apply rules.

MCP SDK v2 authorization helpers/framework integration may be used internally, but the Ladder domain remains independent of a specific credential implementation.

---

## 6. Kubernetes / Jenkins Secret Handling

Production secrets should enter the system through Jenkins credentials and Kubernetes Secrets.

Conceptual flow:

```text
Jenkins credential store
        │
        ├── deploy-time credentials
        ▼
Kubernetes Secret
        │
        ▼
Backend Pod environment / mounted secret
```

Possible V1 variables include:

```env
# Remote MCP machine credential
PLC_LADDER_TOKEN=<long-random-token>

# Single human admin login
PLC_LADDER_WEB_USERNAME=admin
PLC_LADDER_WEB_PASSWORD=<strong-password>
PLC_LADDER_WEB_SESSION_SECRET=<long-random-secret>
PLC_LADDER_WEB_SESSION_TTL_SECONDS=28800
```

These names may be preserved for migration simplicity. The important design rule is where the secrets live, not the exact variable spelling.

Do not:

- bake secrets into Docker images;
- place production credentials in `VITE_*` variables;
- expose MCP tokens in Web runtime configuration;
- commit Kubernetes Secret plaintext values to Git;
- log password/token values.

---

## 7. Session Storage Model

For the first human Web implementation, a signed short-lived session may be returned by the backend.

The preferred production direction is an HTTP-only secure cookie when the frontend and API are same-origin because this avoids exposing the session token to application JavaScript unnecessarily.

If migration from the current `sessionStorage` token implementation is staged, it may remain temporarily during development, but the final V1 deployment should prefer:

- `Secure`;
- `HttpOnly`;
- an appropriate `SameSite` value;
- bounded expiration;
- TLS-only transport.

Session signing secrets must persist across ordinary backend pod restarts or users will be logged out on every redeploy.

---

## 8. Fastify Security Boundary

Fastify 5 is the HTTP composition boundary.

Recommended ownership:

```text
services/mcp-server/src/
├── server.ts                 Fastify application composition
├── auth/
│   ├── web-auth.ts           human credential/session handling
│   └── mcp-auth.ts           machine credential verification
├── routes/
│   ├── auth.ts
│   ├── api.ts
│   └── mcp.ts
└── domain/
    └── ...                   project/Ladder services independent of HTTP auth
```

Authentication should be enforced through Fastify hooks/plugins or route-boundary composition before protected handlers execute.

For MCP SDK v2 + Fastify, authenticated request context may be forwarded into the MCP handler, but MCP tools still call shared domain services rather than bypassing them.

---

## 9. Authorization Scope in V1

V1 has one human administrator, so fine-grained human RBAC is not required.

The important separation is **capability surface**, not user roles:

### Human Web surface

May include:

- create/select/import projects;
- structured manual edit;
- Compile;
- Human Review approval/rejection;
- Apply through approved workflow;
- history/restore actions;
- Export/download.

### AI/MCP surface

May include:

- read project metadata/snapshots;
- read Ladder state relevant to planning;
- submit semantic proposal batches;
- inspect validation/proposal status;
- request non-destructive analysis/export-related operations where allowed by the contract.

AI/MCP must not receive a tool that directly bypasses Human Review to mutate authoritative saved project state.

---

## 10. Database and Authentication

PostgreSQL is mandatory for V1 application persistence, but that does not force V1 human credentials into a multi-user database schema.

For V1:

- project/review/history/audit data is durable in PostgreSQL;
- single-admin login credentials may remain deployment-secret based;
- audit records should still capture the actor type (`human`, `mcp`, `system`) and available identity/context for meaningful traceability.

A future multi-user version may move human accounts/password hashes/sessions into PostgreSQL or an external identity provider.

---

## 11. Security Logging

Security-relevant events should be logged/audited without exposing credentials.

Useful events include:

- successful/failed human login attempts;
- rejected MCP authentication;
- semantic batch submission identity/context;
- Human Review approval/rejection;
- Apply events;
- export events;
- administrative configuration errors affecting auth.

Never log:

- raw passwords;
- bearer tokens;
- session signing secrets;
- full authorization headers.

Rate limiting for login/auth failure endpoints is recommended during implementation, even though a complete security platform is not a separate V1 product requirement.

---

## 12. Deferred Improvements

Not required for V1:

- multi-user registration;
- role-based access control;
- OAuth/OIDC provider integration for human users;
- mandatory machine-token rotation UI;
- per-tool MCP scopes;
- enterprise SSO;
- hardware-backed secrets;
- distributed session store for horizontal multi-node scale.

These may be added later without changing the Ladder IR/domain model.

---

## 13. Current Decision

For V1:

```text
Human auth : single admin -> short-lived secure Web session
MCP auth   : separate machine token/API credential
Runtime    : Fastify 5 boundary
Transport  : HTTPS through Cilium Gateway
Secrets    : Jenkins credentials + Kubernetes Secrets
RBAC       : not required in single-admin V1
```

The key rule is:

> **Human and AI credentials are separate; remote MCP is authenticated; neither credential type can bypass the semantic-batch, validation, Human Review, and Apply safety lifecycle.**

## WORK-026 — account controls inside the application layout (2026-10-02)

AuthGate provides the verified user and existing logout action through a React context. The application renders admin/Sign out in the sidebar footer as normal document flow. There is no fixed-position session chip, shadow or overlay. On narrow screens where the sidebar is hidden, a page footer below the editor status bar reserves its own space and provides the same controls. Only one account section is visible at each breakpoint; the session/token clearing behavior is unchanged.

Verified: production build and full Chromium local/PGlite editor regression, sidebar containment/static positioning, mobile footer clearance, one visible Sign out and logout returning to the login screen. Desktop and narrow screenshots inspected. Web-only change; no backend or database migration.
