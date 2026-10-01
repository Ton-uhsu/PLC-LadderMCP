import { sql, type Kysely } from 'kysely';
export async function up(db: Kysely<any>) {
  await sql`
    CREATE SCHEMA app`.execute(db);
  await sql`CREATE TABLE app.projects (
      id uuid PRIMARY KEY, current_revision_id uuid,
      created_at timestamptz NOT NULL DEFAULT now()
    )`.execute(db);
  await sql`CREATE TABLE app.project_revisions (
      id uuid PRIMARY KEY, project_id uuid NOT NULL REFERENCES app.projects(id),
      revision_no bigint NOT NULL CHECK (revision_no > 0), parent_revision_id uuid,
      origin text NOT NULL CHECK (origin IN ('initial', 'manual_autosave')),
      ir_schema_version text NOT NULL CHECK (ir_schema_version = '0.2'),
      ir_snapshot jsonb NOT NULL CHECK (jsonb_typeof(ir_snapshot) = 'object'),
      content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
      logic_hash text NOT NULL CHECK (logic_hash ~ '^[0-9a-f]{64}$'),
      logic_hash_version text NOT NULL CHECK (logic_hash_version = 'v02-1'),
      plc_family text NOT NULL CHECK (plc_family = 'Mitsubishi FX'),
      plc_model text NOT NULL CHECK (plc_model = 'FX3U'),
      default_export_target text CHECK (default_export_target IN ('gxworks2', 'samsoar2022')),
      actor_key text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (project_id, revision_no), UNIQUE (project_id, id),
      CHECK (ir_snapshot->>'version' = ir_schema_version),
      CHECK (ir_snapshot->'plc'->>'family' = plc_family),
      CHECK (ir_snapshot->'plc'->>'model' = plc_model),
      CHECK ((revision_no = 1 AND parent_revision_id IS NULL) OR
             (revision_no > 1 AND parent_revision_id IS NOT NULL)),
      FOREIGN KEY (project_id, parent_revision_id) REFERENCES app.project_revisions(project_id, id)
    )`.execute(db);
  await sql`ALTER TABLE app.projects ADD CONSTRAINT project_head_same_owner
      FOREIGN KEY (id, current_revision_id) REFERENCES app.project_revisions(project_id, id)`.execute(db);
  await sql`CREATE TABLE app.project_save_requests (
      project_id uuid NOT NULL REFERENCES app.projects(id), actor_key text NOT NULL,
      request_id text NOT NULL, request_hash text NOT NULL,
      revision_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (project_id, actor_key, request_id),
      FOREIGN KEY (project_id, revision_id) REFERENCES app.project_revisions(project_id, id)
    )`.execute(db);
  await sql`CREATE FUNCTION app.reject_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'Immutable project history cannot be changed' USING ERRCODE = '55000'; END;
    $$`.execute(db);
  await sql`CREATE TRIGGER immutable_revisions BEFORE UPDATE OR DELETE OR TRUNCATE ON app.project_revisions
      FOR EACH STATEMENT EXECUTE FUNCTION app.reject_history_mutation()`.execute(db);
  await sql`CREATE TRIGGER immutable_save_requests BEFORE UPDATE OR DELETE OR TRUNCATE ON app.project_save_requests
      FOR EACH STATEMENT EXECUTE FUNCTION app.reject_history_mutation();
  `.execute(db);
}
// Forward-only: dropping authoritative history is not a normal rollback operation.
