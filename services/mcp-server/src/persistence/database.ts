import { Kysely, PostgresDialect, type ColumnType } from 'kysely';
import pg from 'pg';
import type { LadderProjectV02 } from '@plc-ladder-mcp/ladder-ir';

type Time = ColumnType<Date, Date | undefined, never>;
export interface Database {
  'app.projects': { id: string; current_revision_id: string | null; created_at: Time };
  'app.project_revisions': {
    id: string; project_id: string; revision_no: string; parent_revision_id: string | null;
    origin: 'initial' | 'manual_autosave'; ir_schema_version: string;
    ir_snapshot: ColumnType<LadderProjectV02, string, never>; content_hash: string;
    logic_hash: string; logic_hash_version: string; plc_family: string; plc_model: string;
    default_export_target: string | null; actor_key: string; created_at: Time;
  };
  'app.project_save_requests': {
    project_id: string; actor_key: string; request_id: string; request_hash: string;
    revision_id: string; created_at: Time;
  };
}

export function createDatabase(connectionString: string) {
  if (!connectionString) throw new Error('DATABASE_URL is required.');
  return new Kysely<Database>({ dialect: new PostgresDialect({
    pool: new pg.Pool({ connectionString, max: 5, connectionTimeoutMillis: 5000 }),
  }) });
}
