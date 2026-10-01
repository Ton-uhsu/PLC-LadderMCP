# Local PostgreSQL project persistence

This slice implements the project/revision foundation from [the persistence design](../designs/persistence-database-architecture.md). It runs locally; no VPS, Jenkins or Kubernetes setup is needed.

## What is available

- Kysely + pg application queries and Goose SQL migrations with explicit Up/Down.
- Immutable versioned IR v0.2 JSONB snapshots, same-project head/parent FKs and database history-mutation triggers.
- Human-authenticated project create/list/current/historical reads and optimistic autosave.
- Save retries deduplicate by project, actor and request ID; reused keys with different payloads conflict. Identical saves do not manufacture revisions.
- Descriptive name/comment/default-target edits change content history but preserve the logic hash. Logic/topology/order/identity edits change the logic hash.

The Web project picker now uses UUIDs and PostgreSQL when the authenticated capability endpoint reports it configured. Run `npm run dev`, connect to `http://localhost:3001` and sign in with the human admin credentials above. Create or load a project. Open Project settings to rename it or choose its default export IDE; the PLC remains Mitsubishi FX/FX3U. In Ladder, add, delete, move or comment networks; execution position follows array order while IDs stay unchanged on reorder. Edit a contact or coil in the existing basic editor and watch revision/save status. Edit bursts debounce for 500 ms; saves serialize and preserve edits made during an outstanding request. Restart/reload and select the same project to read its saved state.

Save now / Retry retains the original request key and payload after an uncertain save response. A stale conflict retains the draft and blocks project switching; Download draft JSON before confirming Load latest. Unsaved drafts live in browser memory; a tab-close warning helps prevent loss, but does not make an offline durable copy. Undo / redo covers this browser session and saves the resulting snapshot as another revision. Changing server is blocked while dirty. New project creation is not yet idempotent: refresh the picker after an uncertain Create response before deciding to create again.

Without PostgreSQL, project-name/network controls use `/api/manual/project`: a human Web session is required, and the base snapshot must match the current local project. Stale edits return 409 and leave the displayed edit unapplied; Sync now before retrying. The endpoint is disabled when PostgreSQL is configured. Legacy default-target persistence is unavailable and labeled in settings.

Legacy MCP/review routes remain separate and cannot update the selected database project through this UI. AI Review and Export are unavailable for database projects until their revision-bound persistence integration is implemented. Servers explicitly reporting PostgreSQL unconfigured retain the legacy Web workflow. No automatic import of `.plc-ladder` data occurs. AI has no new direct-save tool.

The SQL schema now includes Batch/Review/Apply, Compile/Export/Audit and POC/Evidence tables. Their workflow APIs, UI integration, restore UX and restricted PostgREST ingestion functions/roles remain later slices. Creating their tables does not make those workflows available. Current IR v0.2 is supported strictly: unknown fields/schema versions are rejected rather than discarded. This does not claim the full future V1 IR migration is implemented.

## Prerequisites

Node.js 24, npm 11, Goose v3.28.0 and Docker Desktop with Compose. Download the Goose binary for your platform from https://github.com/pressly/goose/releases/tag/v3.28.0 and add it to PATH, or set `$env:GOOSE_BIN` to its absolute executable path. Goose is a migration CLI; the application continues to use Kysely + pg. The pinned local image follows the accepted PostgreSQL 18.6 baseline. The fixed example credential is local development only; PostgreSQL binds to loopback. Its named volume preserves data across stop/start.

From repository root in PowerShell:

```powershell
npm ci
npm run db:up
$env:DATABASE_URL = "postgresql://plc_local:plc_local_dev@127.0.0.1:54329/plc_ladder_local"
npm run db:migrate:up
$env:PLC_LADDER_WEB_USERNAME = "admin"
$env:PLC_LADDER_WEB_PASSWORD = "local-development-only"
$env:PLC_LADDER_WEB_SESSION_SECRET = "local-development-session-secret"
$env:PLC_LADDER_TOKEN = "local-machine-token"
npm run server
```

Migrations are explicit; server startup does not silently alter schemas. Running `db:migrate:up` again is safe; Goose records applied versions in `public.goose_db_version`. Do not run the removed Kysely migrator against this database. Use the local database owner for this development slice; separate restricted production roles are not configured here. Do not run it against a VPS database.

`npm run db:stop` stops PostgreSQL without deleting its volume. Avoid `docker compose down -v` unless intentionally deleting local data. The server closes its pool on server close; ordinary process exit also releases connections.

## API contract

All routes require a human Web session from `POST /auth/login`. The MCP machine token cannot write to this surface, even when legacy Web auth is unconfigured. Without DATABASE_URL, these routes report unavailable rather than falling back to JSON. The snapshot and revision belong to the same selected project.

| Method/path | Body / result |
| --- | --- |
| GET `/api/persistence/status` | `{ configured: boolean }` for the authenticated Web capability check |
| GET `/api/persistence/projects` | Up to 100 projects with current revision context |
| POST `/api/persistence/projects` | `{ snapshot, defaultExportTarget? }` → initial revision, HTTP 201 |
| GET `/api/persistence/projects/:projectId` | Exact current saved revision and `ir_snapshot` |
| GET `/api/persistence/projects/:projectId/revisions/:revisionNo` | Historical immutable revision |
| POST `/api/persistence/projects/:projectId` | `{ baseRevision, requestId, snapshot, defaultExportTarget? }` → saved/no-op revision |

Revision numbers are decimal strings, UUIDs identify projects/revisions, and returned database fields use snake_case. Save `baseRevision` is the number returned as `revision_no`, not a UUID. Target values are `gxworks2`, `samsoar2022` or null. Omit defaultExportTarget on save to preserve it. New create requests do not yet have idempotency keys; do not blindly retry Create after an uncertain response.

Save conflicts: HTTP 409 `STALE_REVISION` with `currentRevision` or `IDEMPOTENCY_CONFLICT`. Reload/reconcile a stale draft before saving; do not just swap the base number and overwrite current state. A new changed intent needs a new requestId; transport retries reuse the original key/body. Malformed requests return 400, missing project/revision 404, oversized payload 413, unavailable persistence 503. Error responses do not expose database credentials/details.

Autosave accepts structurally representable uncompiled drafts, including semantically invalid device addresses. It does not imply Compile success or Export eligibility. The Web editor debounces edit bursts before this save endpoint.

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
npm run web:test
npm run mcp:build
npm run build
npm run mcp:test
npm run mcp:e2e
```

Web tests cover serialized saves, exact transport retries, conflict recovery, project switching, logout during a save, debounce/undo and reopening saved state against an embedded PostgreSQL repository.

The always-on persistence tests use PGlite (embedded PostgreSQL engine, test dependency only) and cover real SQL migrations/triggers/FKs, canonical hashes, malformed IR, transaction rollback after revision insertion, historical reads, retry/no-op behavior, competing saves, actual application HTTP handler authentication and close/reopen disk durability. PGlite serializes connections: this is not proof of native multi-session PostgreSQL locking or exact PostgreSQL 18.6 behavior.

For native pg-driver/multi-connection coverage on a disposable local test database:

```powershell
docker compose -f compose.local.yaml exec postgres createdb -U plc_local plc_ladder_test
$env:TEST_DATABASE_URL = "postgresql://plc_local:plc_local_dev@127.0.0.1:54329/plc_ladder_test"
npm run db:test
Remove-Item Env:TEST_DATABASE_URL
```

Do not use production/staging data for TEST_DATABASE_URL. The native suite creates test projects and preserves them; create the test database once. Without this variable that suite is explicitly skipped, never reported as passed.

Migration execution uses Goose and PostgreSQL transactions; the repository uses row locking before checking the latest head. References: https://kysely.dev/docs/getting-started and https://www.postgresql.org/docs/18/explicit-locking.html.

## Goose commands and rollback

Run from the repository root with DATABASE_URL set:

```powershell
npm run db:migrate:validate
npm run db:migrate:status
npm run db:migrate:up
npm run db:migrate:down
```

`down` rolls back only the latest applied migration. To roll back every migration on a **disposable local/test database**, use `node scripts/goose.mjs down-to 0`. Down drops the relevant tables and their data; it is not project undo and cannot restore deleted data. Stop the application before migrating down. Ordinary project history remains immutable while the application runs. No Down is executed automatically.

Direct Goose commands are also supported:

```powershell
$env:GOOSE_DRIVER = "postgres"
$env:GOOSE_DBSTRING = $env:DATABASE_URL
goose -dir db/migrations up
goose -dir db/migrations status
goose -dir db/migrations down
```

| Version | SQL file | Scope |
| --- | --- | --- |
| 1 | `00001_project_revisions.sql` | Existing project/revision/save-request foundation |
| 2 | `00002_review_apply.sql` | Batch/proposal/review/validation/Apply and restore provenance |
| 3 | `00003_compile_export_audit.sql` | Compile, export checkpoints/events/bytes, audit and general request deduplication |
| 4 | `00004_poc_evidence.sql` | Fixtures/files/runs/expected-actual IR/compatibility and latest-results view |

SQL owns table boundaries, ownership FKs, append-only history and selected sealing constraints. Application-level authorization, dependency validation, atomic Apply/head publication and metadata-equivalent Compile reuse still require the upcoming repositories/APIs. PostgREST has no evidence grants yet. `compile_diagnostics` is a view over validation diagnostics, not a duplicate table. The four migrations create 27 domain tables.

Down uses explicit dependency order without CASCADE. Version 2 refuses rollback if Apply/restore/schema-migration origins would become invalid under version 1; the whole Down transaction rolls back. Reapplying empty-schema Up after Down is tested. Goose `validate` checks migration structure without connecting to a database.

### Existing Kysely database

If you already ran the previous `001-project-revisions` Kysely migration, do not run Goose Up immediately against it. Stop the application, back up your local database, then run:

```powershell
npm run db:migrate:adopt
npm run db:migrate:status
npm run db:migrate:up
```

Adoption compares the existing foundation's columns, constraints, indexes, triggers and functions to migration 1 inside a transaction. It preserves project/revision/save-request rows and only records Goose versions 0/1 after an exact match. Schema drift or existing Goose history causes refusal with no committed changes. Old Kysely bookkeeping remains as provenance; Goose becomes the only production migration runner. Fresh databases skip adoption.

Embedded tests execute the SQL Up/Down sections transactionally, including adoption, rollback refusal, export checkpoint uniqueness and immutable/checksummed evidence bytes. Goose v3.28.0 CLI validation is also checked. Native Goose execution and PostgreSQL 18.6 multi-session behavior require the local database; embedded SQL tests do not claim that coverage.

For the actual Goose CLI round trip, create a separate fresh disposable database (the test refuses existing app/evidence or migration history):

```powershell
docker compose -f compose.local.yaml exec postgres createdb -U plc_local plc_ladder_goose_test
$env:TEST_GOOSE_DATABASE_URL = "postgresql://plc_local:plc_local_dev@127.0.0.1:54329/plc_ladder_goose_test?sslmode=disable"
npm run db:test
Remove-Item Env:TEST_GOOSE_DATABASE_URL
```

This opt-in test runs the real Goose binary through Up, repeated Up, Status, Down, Up, Down-to-0 and Up. It retains its final schema for inspection; use a fresh database for a later rerun. It is skipped unless TEST_GOOSE_DATABASE_URL is set. GOOSE_BIN/PATH must provide the CLI.
