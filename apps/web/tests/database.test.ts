import test from 'node:test';
import assert from 'node:assert/strict';
import { Kysely, PGliteDialect } from 'kysely';
import { PGlite } from '@electric-sql/pglite';
import { ProjectRepository } from '../../../services/mcp-server/src/persistence/projects.ts';
import { migrateDatabase } from '../../../services/mcp-server/src/persistence/test-support/migrations.ts';
import type { Database } from '../../../services/mcp-server/src/persistence/database.ts';
import { DurableWorkspace, ApiError, type ProjectApi } from '../src/persistence/workspace.ts';
test('Web workspace reopens saved PostgreSQL state and detects another client', async () => {
  const db = new Kysely<Database>({ dialect: new PGliteDialect({ pglite: new PGlite({ parsers: { 20: value => value } }) }) });
  try {
    await migrateDatabase(db); const repository = new ProjectRepository(db);
    const api: ProjectApi = {
      list: () => repository.list(), read: id => repository.read(id), create: snapshot => repository.create(snapshot, 'admin'),
      save: async (id, body) => { try { return await repository.save({ projectId: id, actor: 'admin', ...body }); }
        catch (error) { if ((error as any).code === 'STALE_REVISION') throw new ApiError(409, 'STALE_REVISION'); throw error; } },
    };
    const first = new DurableWorkspace(api, 60_000); await first.create('Local project');
    const id = first.state.projectId!; const edited = structuredClone(first.state.project!);
    edited.programs[0].networks[0].comment = 'Saved comment'; first.edit(edited); first.editDefaultTarget('gxworks2'); await first.flush();
    const reopened = new DurableWorkspace(api, 60_000); await reopened.refresh(); await reopened.select(id);
    assert.equal(reopened.state.defaultExportTarget, 'gxworks2');
    assert.equal(reopened.state.project!.programs[0].networks[0].comment, 'Saved comment');
    assert.equal((await repository.read(id, '1')).default_export_target, null);
    assert.equal((await repository.read(id, '1')).ir_snapshot.programs[0].networks[0].comment, undefined);
    const remote = structuredClone(reopened.state.project!); remote.name = 'Remote rename'; reopened.edit(remote); await reopened.flush();
    const stale = structuredClone(first.state.project!); stale.name = 'Stale rename'; first.edit(stale);
    await assert.rejects(first.flush()); assert.equal(first.state.saveStatus, 'conflict');
    assert.equal((await repository.read(id)).ir_snapshot.name, 'Remote rename');
  } finally { await db.destroy(); }
});
