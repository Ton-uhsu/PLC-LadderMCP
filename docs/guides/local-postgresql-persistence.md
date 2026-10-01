# Local PostgreSQL project persistence

This slice implements the project/revision foundation from [the persistence design](../designs/persistence-database-architecture.md). It runs locally; no VPS, Jenkins or Kubernetes setup is needed.

## What is available

- Kysely + pg database connection and forward-only migration.
- Immutable versioned IR v0.2 JSONB snapshots, same-project head/parent FKs and database history-mutation triggers.
- Human-authenticated project create/list/current/historical reads and optimistic autosave.
- Save retries deduplicate by project, actor and request ID; reused keys with different payloads conflict. Identical saves do not manufacture revisions.
- Descriptive name/comment/default-target edits change content history but preserve the logic hash. Logic/topology/order/identity edits change the logic hash.

The current browser editor and MCP/review routes still use the legacy JSON/in-memory workflow. They are not silently connected to this database yet. The new API is an explicit foundation for their later integration; database projects do not appear automatically in the existing project picker. No automatic import of `.plc-ladder` data occurs. AI has no new direct-save tool.

Batch/review persistence, Compile/export gates/history, restore UX and PostgREST evidence are later slices. Current IR v0.2 is supported strictly: unknown fields/schema versions are rejected rather than discarded. This does not claim the full future V1 IR migration is implemented.

## Prerequisites

Node.js 24, npm 11 and Docker Desktop with Compose. The pinned local image follows the accepted PostgreSQL 18.6 baseline. The fixed example credential is local development only; PostgreSQL binds to loopback. Its named volume preserves data across stop/start.

From repository root in PowerShell:

```powershell
npm ci
npm run db:up
$env:DATABASE_URL = "postgresql://plc_local:plc_local_dev@127.0.0.1:54329/plc_ladder_local"
npm run db:migrate
$env:PLC_LADDER_WEB_USERNAME = "admin"
$env:PLC_LADDER_WEB_PASSWORD = "local-development-only"
$env:PLC_LADDER_WEB_SESSION_SECRET = "local-development-session-secret"
$env:PLC_LADDER_TOKEN = "local-machine-token"
npm run server
```

Migrations are explicit; server startup does not silently alter schemas. Running `db:migrate` again is safe. Use the local database owner for this development slice; separate restricted production roles are not configured here. Do not run it against a VPS database.

`npm run db:stop` stops PostgreSQL without deleting its volume. Avoid `docker compose down -v` unless intentionally deleting local data. The server closes its pool on server close; ordinary process exit also releases connections.

## API contract

All routes require a human Web session from `POST /auth/login`. The MCP machine token cannot write to this surface, even when legacy Web auth is unconfigured. Without DATABASE_URL, these routes report unavailable rather than falling back to JSON. The snapshot and revision belong to the same selected project.

| Method/path | Body / result |
| --- | --- |
| GET `/api/persistence/projects` | Up to 100 projects with current revision context |
| POST `/api/persistence/projects` | `{ snapshot, defaultExportTarget? }` → initial revision, HTTP 201 |
| GET `/api/persistence/projects/:projectId` | Exact current saved revision and `ir_snapshot` |
| GET `/api/persistence/projects/:projectId/revisions/:revisionNo` | Historical immutable revision |
| POST `/api/persistence/projects/:projectId` | `{ baseRevision, requestId, snapshot, defaultExportTarget? }` → saved/no-op revision |

Revision numbers are decimal strings, UUIDs identify projects/revisions, and returned database fields use snake_case. Save `baseRevision` is the number returned as `revision_no`, not a UUID. Target values are `gxworks2`, `samsoar2022` or null. Omit defaultExportTarget on save to preserve it. New create requests do not yet have idempotency keys; do not blindly retry Create after an uncertain response.

Save conflicts: HTTP 409 `STALE_REVISION` with `currentRevision` or `IDEMPOTENCY_CONFLICT`. Reload/reconcile a stale draft before saving; do not just swap the base number and overwrite current state. A new changed intent needs a new requestId; transport retries reuse the original key/body. Malformed requests return 400, missing project/revision 404, oversized payload 413, unavailable persistence 503. Error responses do not expose database credentials/details.

Autosave accepts structurally representable uncompiled drafts, including semantically invalid device addresses. It does not imply Compile success or Export eligibility. The frontend integration will debounce edit bursts before this save endpoint.

### Minimal local exercise

In another PowerShell window:

```powershell
$base = "http://localhost:3001"
$login = Invoke-RestMethod -Method Post -Uri "$base/auth/login" -ContentType "application/json" -Body (@{
  username = "admin"; password = "local-development-only"
} | ConvertTo-Json)
$headers = @{ Authorization = "Bearer $($login.token)" }
$snapshot = @{
  version = "0.2"; name = "Local FX3U draft"
  plc = @{ family = "Mitsubishi FX"; model = "FX3U" }
  programs = @(@{ name = "Main"; networks = @(@{
    id = 0; root = @{ kind = "series"; id = "network-0"; children = @() }
  }) })
}
$created = Invoke-RestMethod -Method Post -Uri "$base/api/persistence/projects" -Headers $headers -ContentType "application/json" -Body (@{
  snapshot = $snapshot
} | ConvertTo-Json -Depth 40)
$id = $created.project_id
$snapshot.name = "Renamed local draft"
$saved = Invoke-RestMethod -Method Post -Uri "$base/api/persistence/projects/$id" -Headers $headers -ContentType "application/json" -Body (@{
  baseRevision = $created.revision_no; requestId = [guid]::NewGuid().ToString(); snapshot = $snapshot
} | ConvertTo-Json -Depth 40)
Invoke-RestMethod -Uri "$base/api/persistence/projects/$id/revisions/1" -Headers $headers
```

Restart the backend and read the project again using a fresh login if necessary. Revision 1 retains its original name; the current head has the saved name. The minimal empty draft is deliberately uncompiled.

## Verification

```powershell
npm run db:test
npm run mcp:build
npm run build
npm run mcp:test
npm run mcp:e2e
```

The always-on persistence tests use PGlite (embedded PostgreSQL engine, test dependency only) and cover real SQL migrations/triggers/FKs, canonical hashes, malformed IR, transaction rollback after revision insertion, historical reads, retry/no-op behavior, competing saves, actual application HTTP handler authentication and close/reopen disk durability. PGlite serializes connections: this is not proof of native multi-session PostgreSQL locking or exact PostgreSQL 18.6 behavior.

For native pg-driver/multi-connection coverage on a disposable local test database:

```powershell
docker compose -f compose.local.yaml exec postgres createdb -U plc_local plc_ladder_test
$env:TEST_DATABASE_URL = "postgresql://plc_local:plc_local_dev@127.0.0.1:54329/plc_ladder_test"
npm run db:test
Remove-Item Env:TEST_DATABASE_URL
```

Do not use production/staging data for TEST_DATABASE_URL. The native suite creates test projects and preserves them; create the test database once. Without this variable that suite is explicitly skipped, never reported as passed.

Migration access uses Kysely's built-in migrator and PostgreSQL transaction support; the repository uses row locking before checking the latest head. References: https://kysely.dev/docs/getting-started and https://www.postgresql.org/docs/18/explicit-locking.html.
