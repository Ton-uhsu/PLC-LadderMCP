# PLC-LadderMCP Deployment Architecture

**Document:** `docs/06-deployment-architecture.md`  
**Status:** Deployment Decision  
**Version:** 0.1  
**Date:** 2026-09-29

## 1. Goal

Define how PLC-LadderMCP should be deployed for real use without requiring the developer's local computer to remain online.

The agreed direction is to keep the frontend on GitHub Pages and run only the backend/MCP service on an existing VPS.

## 2. Selected Deployment Model

```text
Browser
   │
   ▼
GitHub Pages
React / Vite Frontend
   │
   │ HTTPS
   ▼
VPS
Reverse Proxy / TLS
   │
   ▼
Node.js MCP / HTTP Server
   │
   ├── Ladder IR project persistence
   ├── AI proposals
   ├── Human Review queue
   └── validation / semantic operations
```

The frontend does not need to move to the VPS.

## 3. Frontend

The web application remains deployed through GitHub Pages.

Responsibilities:

- render Ladder Preview
- show project/network structure
- show validation results
- show AI Changes / Human Review
- approve or reject pending proposals
- call the remote MCP/API backend over HTTPS

GitHub Pages continues to serve only static frontend assets.

## 4. Backend / MCP Server

The Node.js MCP/HTTP server runs on the existing VPS.

Recommended runtime options:

1. Docker container — preferred for isolation from other projects on the same VPS
2. systemd/PM2-managed Node.js process — acceptable for a simple first deployment

The service should listen on a private/internal port such as:

```text
127.0.0.1:3001
```

The application port should not be exposed directly to the public internet when a reverse proxy is available.

## 5. VPS Sharing

The VPS may continue running other projects.

Each project should be isolated by container or, at minimum, separate process and port.

Example:

```text
VPS
├── Existing Project       : internal port 3000
├── PLC-LadderMCP Server   : internal port 3001
└── Reverse Proxy          : public HTTPS entry point
```

Resource limits should be applied if multiple Docker containers share the same VPS.

## 6. HTTPS Requirement

The GitHub Pages frontend is served over HTTPS. Therefore the browser-facing backend must also be reachable over HTTPS.

Do not use this architecture in production:

```text
https://github-pages.example
        │
        └──> http://VPS-IP:3001
```

Browsers can block this as mixed content.

Use this instead:

```text
https://GitHub-Pages
        │
        └──> https://VPS-ENDPOINT
                 │
                 └──> http://127.0.0.1:3001
```

A reverse proxy such as Nginx or Caddy should terminate TLS and forward requests to the internal Node.js service.

The project does not require moving the frontend to the VPS or purchasing a new domain solely for the frontend.

## 7. CORS

The backend should explicitly allow only the GitHub Pages frontend origin used by PLC-LadderMCP.

Conceptually:

```text
Allowed-Origin: https://<github-pages-origin>
```

Avoid wildcard CORS (`*`) once authentication or user-specific project data is involved.

Local development origins can be allowed separately when required.

## 8. Authentication

The current backend supports Bearer token authentication.

For the initial VPS deployment:

- keep authentication enabled for the public HTTPS endpoint
- store secrets only on the VPS
- do not commit production tokens into Git
- do not expose a reusable server master token directly inside a public frontend bundle

Longer term, replace a shared long-lived token with a user/session or short-lived token model if the application becomes multi-user.

## 9. Current Persistence Limitation

The canonical project already has filesystem persistence, but some runtime state is still process-local/in-memory.

Important example:

- pending AI proposals / Human Review state may be held in memory
- undo/redo or transient runtime state may also be process-local

This means a server restart, redeploy, or process crash can still lose pending review state even when the VPS itself is persistent.

Therefore VPS hosting solves the "developer PC must stay online" problem, but it does not automatically make all application state durable.

## 10. Persistence Roadmap

### Phase 1 — Current VPS MVP

Use a single MCP/API server instance on the VPS.

```text
GitHub Pages
     │
     ▼
VPS HTTPS Endpoint
     │
     ▼
Single MCP/API Process
     │
     └── filesystem project JSON
```

This is acceptable for initial personal/team testing.

### Phase 2 — Durable Human Review

Move pending review state out of process memory.

Recommended durable records:

- projects
- project revisions
- AI proposals
- proposal status: pending / approved / rejected / applied
- proposal timestamps
- validation results or references
- actor/user metadata when authentication exists

PostgreSQL is the preferred candidate when durable multi-user/project state becomes necessary.

### Phase 3 — Stateless Backend

After important state is moved to durable storage, the Node.js service can become largely stateless.

That makes restart, deployment, recovery, and later horizontal scaling safer.

## 11. Proposed Production Direction

```text
                     AI Client / OpenCode
                             │
                             │ MCP over HTTPS
                             ▼
Browser ──> GitHub Pages ──> VPS Reverse Proxy
                             │
                             ▼
                        MCP/API Server
                             │
                    ┌────────┴────────┐
                    ▼                 ▼
              Ladder IR files    PostgreSQL
              / artifacts        durable state
```

PostgreSQL is not mandatory for the first VPS deployment. It becomes important when Human Review state, project history, users, or collaboration must survive all restarts reliably.

## 12. Deployment Priorities

Recommended implementation order:

1. prepare MCP server for VPS runtime
2. isolate it from other VPS projects using Docker or a dedicated service
3. place it behind HTTPS reverse proxy
4. configure CORS for the GitHub Pages origin
5. configure production authentication/secrets
6. point the GitHub Pages frontend to the VPS backend
7. verify AI -> proposal -> Human Review -> Apply end to end remotely
8. make pending Human Review state durable
9. add PostgreSQL only when the durable-state requirement is implemented

## 13. Current Decision

The selected deployment architecture is:

```text
Frontend  : GitHub Pages
Backend   : Existing VPS
Runtime   : Node.js MCP/HTTP server
Isolation : Docker preferred
Transport : HTTPS
Proxy/TLS : Nginx or Caddy
State     : filesystem + current in-memory state for MVP
Future    : PostgreSQL for durable AI Review/project metadata
```

The key deployment rule is:

> **GitHub Pages remains the frontend. The VPS runs only the backend/MCP service. The developer's local machine must not be required for normal operation.**
