import test from 'node:test';
import { Readable } from 'node:stream';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Kysely, PGliteDialect, sql } from 'kysely';
import { PGlite } from '@electric-sql/pglite';
import { m0ToY0Y5Fixture } from '@plc-ladder-mcp/ladder-ir';
import { createDatabase, type Database } from './database.js';
import { migrateDatabase } from './test-support/migrations.js';
import { ProjectRepository } from './projects.js';
import { createApplicationServer } from '../server.js';
import { createWebAuth } from '../auth/web-auth.js';

async function exercise(db: Kysely<Database>) {
  await migrateDatabase(db); await migrateDatabase(db);
  const store = new ProjectRepository(db);
  const fixture = structuredClone(m0ToY0Y5Fixture);
  const initial = await store.create(fixture, 'admin');
  const renamed = structuredClone(fixture); renamed.name = 'Metadata';
  const save = { projectId: initial.project_id, baseRevision: '1', snapshot: renamed, actor: 'admin', requestId: 'first-save' };
  const second = await store.save(save);
  assert.equal(second.revision_no, '2'); assert.equal(second.logic_hash, initial.logic_hash);
  assert.equal((await store.read(initial.project_id, '1')).ir_snapshot.name, fixture.name);
  assert.equal((await store.save(save)).id, second.id, 'retry returns original result before stale check');
  await assert.rejects(store.save({ ...save, snapshot: fixture }), { code: 'IDEMPOTENCY_CONFLICT' });
  const unchanged = await store.save({ ...save, baseRevision: '2', requestId: 'no-op' });
  assert.equal(unchanged.id, second.id);
  const a = structuredClone(renamed); a.name = 'Concurrent A';
  const b = structuredClone(renamed); b.name = 'Concurrent B';
  const results = await Promise.allSettled([
    store.save({ ...save, baseRevision: '2', snapshot: a, requestId: 'a' }),
    store.save({ ...save, baseRevision: '2', snapshot: b, requestId: 'b' }),
  ]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  const failed = results.find(r => r.status === 'rejected');
  assert.equal(failed?.status === 'rejected' && failed.reason.code, 'STALE_REVISION');
  assert.equal((await store.read(initial.project_id)).revision_no, '3');
  await assert.rejects(sql`UPDATE app.project_revisions SET actor_key = 'tamper' WHERE id = ${initial.id}::uuid`.execute(db), /Immutable/);
  await assert.rejects(sql`DELETE FROM app.project_revisions WHERE id = ${initial.id}::uuid`.execute(db), /Immutable/);
  await sql`ALTER TABLE app.project_save_requests ADD CONSTRAINT test_failure CHECK (request_id <> 'force-fail')`.execute(db);
  try {
    await assert.rejects(store.save({ ...save, baseRevision: '3', snapshot: fixture, requestId: 'force-fail' }));
    assert.equal((await store.read(initial.project_id)).revision_no, '3', 'failed request insertion rolls back revision and head');
    await assert.rejects(store.read(initial.project_id, '4'), { code: 'NOT_FOUND' });
  } finally { await sql`ALTER TABLE app.project_save_requests DROP CONSTRAINT test_failure`.execute(db); }
  const other = await store.create(fixture, 'admin');
  await assert.rejects(db.updateTable('app.projects').set({ current_revision_id: initial.id }).where('id', '=', other.project_id).execute());
  const rollbackProject = '00000000-0000-4000-8000-000000000001';
  await assert.rejects(db.transaction().execute(async trx => {
    await trx.insertInto('app.projects').values({ id: rollbackProject, current_revision_id: null }).execute();
    throw new Error('simulated failure');
  }));
  assert.equal((await db.selectFrom('app.projects').selectAll().where('id', '=', rollbackProject).execute()).length, 0);
  const webAuth = createWebAuth({ username: 'admin', password: 'test-only', secret: 'test-session-secret' });
  const server = createApplicationServer({ token: 'machine-only', webAuth, projectRepository: store });
  // Exercise the actual HTTP handler without opening a TCP port.
  async function request(path: string, token = '', body?: unknown) {
    const req = Readable.from(body ? [Buffer.from(JSON.stringify(body))] : []) as any;
    req.method = body ? 'POST' : 'GET'; req.url = path;
    req.headers = { host: 'localhost', authorization: token ? `Bearer ${token}` : '' };
    return new Promise<{ status: number; body: any }>((resolve, reject) => {
      let status = 0;
      const res = { headersSent: false, writeHead(code: number) { status = code; this.headersSent = true; },
        end(data: string) { resolve({ status, body: data ? JSON.parse(data) : null }); } };
      Promise.resolve((server.listeners('request')[0] as any)(req, res)).catch(reject);
    });
  }
  const base = '/api/persistence/projects';
  assert.equal((await request(base)).status, 401);
  assert.equal((await request(base, 'machine-only')).status, 401);
  assert.equal((await request('/api/persistence/status', 'machine-only')).status, 401);
  const token = webAuth.issueSession();
  assert.deepEqual((await request('/api/persistence/status', token)).body, { configured: true });
  assert.equal((await request(`${base}/${initial.project_id}`, token)).body.revision_no, '3');
  const stale = await request(`${base}/${initial.project_id}`, token,
    { baseRevision: '1', requestId: 'api-stale', snapshot: fixture });
  assert.equal(stale.status, 409); assert.equal(stale.body.currentRevision, '3');
  const listed = await request(base, token);
  assert.equal(listed.status, 200); assert.equal('ir_snapshot' in listed.body[0], false);
  const created = await request(base, token, { snapshot: fixture, defaultExportTarget: 'gxworks2' });
  assert.equal(created.status, 201); assert.equal(created.body.default_export_target, 'gxworks2');
  const saved = await request(`${base}/${created.body.project_id}`, token,
    { baseRevision: '1', requestId: 'http-save', snapshot: renamed });
  assert.equal(saved.status, 200); assert.equal(saved.body.revision_no, '2');
  assert.equal(saved.body.default_export_target, 'gxworks2');
  assert.equal((await request(`${base}/${created.body.project_id}`, token,
    { baseRevision: '2', requestId: 'bad', snapshot: { version: 'unknown' } })).status, 400);

  return initial.project_id;
}

test('embedded PostgreSQL engine: SQL constraints, repository, HTTP auth and reopen durability', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'plc-revisions-'));
  function open() { return new Kysely<Database>({ dialect: new PGliteDialect({ pglite: new PGlite(dir, { parsers: { 20: value => value } }) }) }); }
  let db = open();
  try {
    const projectId = await exercise(db); await db.destroy(); db = open();
    assert.equal((await new ProjectRepository(db).read(projectId)).revision_no, '3');
    assert.equal((await new ProjectRepository(db).read(projectId, '1')).revision_no, '1');
  } finally { await db.destroy(); await rm(dir, { recursive: true, force: true }); }
});

test('native PostgreSQL via pg: multi-connection locks and pool restart durability', { skip: !process.env.TEST_DATABASE_URL }, async () => {
  // Must point to an empty disposable database: migration creates app schema.
  const url = process.env.TEST_DATABASE_URL!; let db = createDatabase(url);
  try {
    const id = await exercise(db); await db.destroy(); db = createDatabase(url);
    assert.equal((await new ProjectRepository(db).read(id)).revision_no, '3');
  } finally { await db.destroy(); }
});
