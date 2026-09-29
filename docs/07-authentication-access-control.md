# PLC-LadderMCP Authentication & Access Control

**Document:** `docs/07-authentication-access-control.md`  
**Status:** MVP Security Decision  
**Version:** 0.1  
**Date:** 2026-09-29

## 1. Goal

Add a minimal login boundary before exposing the PLC-LadderMCP backend on a public VPS, while keeping human Web access separate from AI/MCP machine access.

The first MVP uses one administrator account configured from environment variables. User registration, password reset, multi-user roles, and database-backed accounts are intentionally deferred.

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
short-lived Web session token
    │
    └──> /api/*

OpenCode / AI client
    │
    │ PLC_LADDER_TOKEN
    ▼
/mcp
```

Rules:

- The browser never needs the MCP machine token.
- `/api/*` is a human-facing control surface and uses the Web session when Web auth is configured.
- `/mcp` remains machine-token protected.
- Approval/rejection, undo/redo, project management, and Human Review stay outside the MCP tool surface.

## 3. Environment Variables

```env
# Machine credential for OpenCode / Remote MCP only
PLC_LADDER_TOKEN=<long-random-token>

# MVP human login
PLC_LADDER_WEB_USERNAME=admin
PLC_LADDER_WEB_PASSWORD=<strong-password>
PLC_LADDER_WEB_SESSION_SECRET=<long-random-secret>
PLC_LADDER_WEB_SESSION_TTL_SECONDS=28800

# GitHub Pages origin in production
CORS_ORIGIN=https://<github-user>.github.io
```

`PLC_LADDER_WEB_PASSWORD` is stored directly in the process environment for the first MVP. This is acceptable only as a temporary deployment step. The next authentication iteration should store password hashes in a durable user database or move to an external identity provider.

`PLC_LADDER_WEB_SESSION_SECRET` should always be explicitly configured on the VPS. If omitted, the server generates a temporary secret and all Web sessions become invalid after a restart.

## 4. Session Model

The backend issues a signed short-lived session token after successful login.

Default lifetime:

```text
8 hours / 28,800 seconds
```

The frontend stores the Web session only in `sessionStorage`, so it does not survive closing the browser tab/session.

The API URL remains in `localStorage` so the login form remembers the backend address.

## 5. Routes

Public/authentication routes:

```text
POST /auth/login
GET  /auth/session
GET  /health
```

Human Web routes:

```text
/api/*
```

AI/MCP route:

```text
/mcp
```

When Web authentication is configured, presenting `PLC_LADDER_TOKEN` to `/api/*` must not grant human access. The server validates the human session first and injects the internal machine credential only inside the backend process when handing the request to the existing HTTP implementation.

## 6. Frontend / Backend Folder Structure

Authentication code is kept outside the large Ladder UI and project engine files.

```text
apps/
└── web/
    └── src/
        ├── auth/
        │   ├── AuthGate.tsx       login/session UI boundary
        │   ├── session.ts         browser session helpers + auth API calls
        │   └── auth.css           auth-only styling
        ├── App.tsx                Ladder application UI
        ├── store.ts               project/application state
        └── main.tsx               application composition

services/
└── mcp-server/
    └── src/
        ├── auth/
        │   └── web-auth.ts        credential check + signed Web sessions
        ├── server.ts              public HTTP composition/auth boundary
        ├── http.ts                existing project/API + Remote MCP implementation
        ├── mcp.ts                 AI-facing MCP tools
        └── project.ts             Ladder/project domain logic
```

This separation is intentional:

- `App.tsx` should not contain credential verification logic.
- `project.ts` should not know about login/session details.
- `mcp.ts` should not expose human approval controls.
- `server.ts` decides which credential type may enter each HTTP boundary.

## 7. Production Deployment Flow

```text
GitHub Pages
     │
     │ HTTPS
     ▼
VPS reverse proxy / TLS
     │
     ▼
services/mcp-server
     ├── /auth/*  Web login/session
     ├── /api/*   Human session required
     └── /mcp     Machine token required
```

Before public exposure:

1. Set a strong `PLC_LADDER_TOKEN`.
2. Set `PLC_LADDER_WEB_USERNAME` and `PLC_LADDER_WEB_PASSWORD`.
3. Set a persistent random `PLC_LADDER_WEB_SESSION_SECRET`.
4. Restrict `CORS_ORIGIN` to the GitHub Pages origin.
5. Terminate TLS/HTTPS at the VPS reverse proxy.
6. Do not expose the Node port directly if the reverse proxy can be the only public entry point.

## 8. Deferred Improvements

After the VPS deployment is stable:

- move users/password hashes to PostgreSQL
- use Argon2id or bcrypt password hashes instead of a plaintext environment password
- add roles/permissions if more than one human user is required
- add server-side session revocation or refresh-token handling if required
- add login rate limiting and security audit events
- persist Human Review / pending AI changes in PostgreSQL

## 9. Current Decision

For the current MVP:

> **One admin account is configured in ENV, the browser receives a short-lived Web session, and the AI/MCP client uses a completely separate machine token. Frontend and backend authentication code remain in dedicated folders.**
