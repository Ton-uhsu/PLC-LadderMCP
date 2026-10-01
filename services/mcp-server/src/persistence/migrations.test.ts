import test from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import assert from 'node:assert/strict';
import { Kysely, PGliteDialect, sql } from 'kysely';
import { ProjectRepository } from './projects.js';
import { m0ToY0Y5Fixture } from '@plc-ladder-mcp/ladder-ir';
import { PGlite } from '@electric-sql/pglite';
import { migrationFiles, runMigration } from './test-support/migrations.js';
import * as legacy from './test-support/legacy-migration.js';
// JS command exports a testable one-time adoption operation, not a second migration runner.
// @ts-ignore ESM script intentionally has no generated TypeScript declaration.
import { adoptKysely } from '../../../../scripts/adopt-kysely.mjs';
const open = () => new Kysely<any>({ dialect: new PGliteDialect({ pglite: new PGlite() }) });
test('SQL migrations up/down/up recreate all reviewed tables without CASCADE', async () => {
  const db = open();
  try {
    const files = await migrationFiles(); for (const file of files) await runMigration(db, file, 'Up');
    const tables = await sql<{ n: string }>`SELECT count(*)::text AS n FROM information_schema.tables WHERE table_schema IN ('app','evidence') AND table_type = 'BASE TABLE'`.execute(db);
    assert.equal(tables.rows[0].n, '27');
    for (const file of [...files].reverse()) await runMigration(db, file, 'Down');
    assert.equal((await sql<{ app: string | null; evidence: string | null }>`SELECT to_regnamespace('app') AS app, to_regnamespace('evidence') AS evidence`.execute(db)).rows[0].app, null);
    for (const file of files) await runMigration(db, file, 'Up');
  } finally { await db.destroy(); }
});
test('adopt exact Kysely foundation preserves data; schema drift rolls back handoff', async () => {
  const pglite = new PGlite(); const db = new Kysely<any>({ dialect: new PGliteDialect({ pglite }) });
  try {
    await legacy.up(db);
    await sql`CREATE TABLE public.kysely_migration (name text PRIMARY KEY)`.execute(db);
    await sql`INSERT INTO public.kysely_migration VALUES ('001-project-revisions')`.execute(db);
    const repository = new ProjectRepository(db);
    const saved = await repository.create(structuredClone(m0ToY0Y5Fixture), 'admin');
    await sql`ALTER TABLE app.projects ADD COLUMN drift text`.execute(db);
    await assert.rejects(adoptKysely(pglite), /differs/);
    assert.equal((await sql<{ version: string | null }>`SELECT to_regclass('public.goose_db_version') AS version`.execute(db)).rows[0].version, null);
    await sql`ALTER TABLE app.projects DROP COLUMN drift`.execute(db);
    await adoptKysely(pglite);
    assert.equal((await sql<{ n: string }>`SELECT count(*)::text AS n FROM app.projects`.execute(db)).rows[0].n, '1');
    assert.equal((await sql<{ version: string }>`SELECT max(version_id)::text AS version FROM public.goose_db_version`.execute(db)).rows[0].version, '1');
    for (const file of (await migrationFiles()).slice(1)) await runMigration(db, file, 'Up');
    assert.deepEqual((await repository.read(saved.project_id)).ir_snapshot, saved.ir_snapshot);
    assert.equal((await repository.read(saved.project_id)).id, saved.id);
  } finally { await db.destroy(); }
});
test('rollback to the foundation refuses to erase incompatible Apply/restore history atomically', async () => {
  const db = open();
  try {
    const files = await migrationFiles();
    await runMigration(db, files[0], 'Up'); await runMigration(db, files[1], 'Up');
    const repository = new ProjectRepository(db);
    const initial = await repository.create(structuredClone(m0ToY0Y5Fixture), 'admin');
    await sql`INSERT INTO app.project_revisions
      (id, project_id, revision_no, parent_revision_id, origin, ir_schema_version, ir_snapshot,
       content_hash, logic_hash, logic_hash_version, plc_family, plc_model, default_export_target, actor_key, restored_from_revision_id)
      SELECT '00000000-0000-4000-8000-000000000002'::uuid, project_id, 2, id, 'restore', ir_schema_version, ir_snapshot,
       content_hash, logic_hash, logic_hash_version, plc_family, plc_model, default_export_target, actor_key, id
      FROM app.project_revisions WHERE id = ${initial.id}::uuid`.execute(db);
    await assert.rejects(runMigration(db, files[1], 'Down'), /project_revisions_origin_check/);
    assert.equal((await sql<{ n: string }>`SELECT count(*)::text AS n FROM app.project_revisions`.execute(db)).rows[0].n, '2');
    assert.equal((await sql<{ present: string }>`SELECT to_regclass('app.review_events')::text AS present`.execute(db)).rows[0].present, 'app.review_events');
  } finally { await db.destroy(); }
});
test('export checkpoint uniqueness and evidence bytes/immutability are enforced by SQL', async () => {
  const db = open();
  try {
    for (const file of await migrationFiles()) await runMigration(db, file, 'Up');
    const initial = await new ProjectRepository(db).create(structuredClone(m0ToY0Y5Fixture), 'admin');
    await sql`INSERT INTO app.export_versions(id, project_id, project_revision_id)
      VALUES ('00000000-0000-4000-8000-000000000003', ${initial.project_id}::uuid, ${initial.id}::uuid)`.execute(db);
    await assert.rejects(sql`INSERT INTO app.export_versions(id, project_id, project_revision_id)
      VALUES ('00000000-0000-4000-8000-000000000004', ${initial.project_id}::uuid, ${initial.id}::uuid)`.execute(db), /unique/);
    await sql`INSERT INTO evidence.poc_fixtures(id,fixture_key,name,feature,classification)
      VALUES ('00000000-0000-4000-8000-000000000005','fixture','Fixture','contact','common')`.execute(db);
    const insertFile = (length: number) => sql`INSERT INTO evidence.poc_fixture_files
      (id,fixture_id,version_no,vendor,ide_version,format,filename,encoding,media_type,content,byte_length,sha256)
      VALUES ('00000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000005',1,
      'gxworks2','test','csv','fixture.csv','utf-8','text/csv',decode('4142','hex'),${length},encode(sha256(decode('4142','hex')),'hex'))`.execute(db);
    await assert.rejects(insertFile(3), /check constraint/); await insertFile(2);
    await assert.rejects(sql`UPDATE evidence.poc_fixture_files SET filename = 'changed.csv'`.execute(db), /Immutable/);
    const bytes = await sql<{ hex: string }>`SELECT encode(content,'hex') AS hex FROM evidence.poc_fixture_files`.execute(db);
    assert.equal(bytes.rows[0].hex, '4142');
  } finally { await db.destroy(); }
});

test('native Goose CLI up/down-to-0/up on a disposable empty database', { skip: !process.env.TEST_GOOSE_DATABASE_URL }, async () => {
  const client = new pg.Client({ connectionString: process.env.TEST_GOOSE_DATABASE_URL });
  await client.connect();
  try {
    const preflight = await client.query("SELECT to_regnamespace('app') AS app, to_regnamespace('evidence') AS evidence, to_regclass('public.goose_db_version') AS history, to_regclass('public.kysely_migration') AS legacy");
    assert.ok(Object.values(preflight.rows[0]).every(value => value === null), 'Use a fresh disposable database with no app/evidence or migration history.');
    const run = (command: string, target?: string) => promisify(execFile)(process.execPath,
      [fileURLToPath(new URL('../../../../scripts/goose.mjs', import.meta.url)), command, ...(target ? [target] : [])],
      { env: { ...process.env, DATABASE_URL: process.env.TEST_GOOSE_DATABASE_URL } });
    await run('up'); await run('up'); await run('status');
    const count = await client.query("SELECT count(*)::text AS n FROM information_schema.tables WHERE table_schema IN ('app','evidence') AND table_type = 'BASE TABLE'");
    assert.equal(count.rows[0].n, '27');
    await run('down');
    assert.equal((await client.query("SELECT to_regnamespace('evidence') AS present")).rows[0].present, null);
    await run('up'); await run('down-to', '0');
    assert.equal((await client.query("SELECT to_regnamespace('app') AS present")).rows[0].present, null);
    await run('up');
    assert.equal((await client.query('SELECT max(version_id)::text AS version FROM public.goose_db_version WHERE is_applied')).rows[0].version, '4');
  } finally { await client.end(); }
});
