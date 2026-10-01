import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DurableWorkspace, ApiError, type ProjectApi, type Revision, type SaveBody } from '../src/persistence/workspace.ts';
const snapshot = (name: string) => ({ version: '0.2' as const, name, plc: { family: 'Mitsubishi FX', model: 'FX3U' }, programs: [{ name: 'Main', networks: [] }] });
function setup() {
  const revisions = new Map<string, Revision>(['a', 'b'].map(id => [id, { project_id: id, revision_no: '1', ir_snapshot: snapshot(id) }]));
  const calls: { id: string; body: SaveBody }[] = [];
  const retries = new Map<string, Revision>();
  const api: ProjectApi = {
    list: async () => [...revisions.values()].map(r => ({ id: r.project_id, name: r.ir_snapshot.name, revision_no: r.revision_no })),
    read: async id => structuredClone(revisions.get(id)!),
    create: async project => ({ project_id: 'c', revision_no: '1', ir_snapshot: project }),
    save: async (id, body) => {
      calls.push(structuredClone({ id, body }));
      if (retries.has(body.requestId)) return retries.get(body.requestId)!;
      const old = revisions.get(id)!;
      if (old.revision_no !== body.baseRevision) throw new ApiError(409, 'STALE_REVISION');
      const saved = { project_id: id, revision_no: String(Number(old.revision_no) + 1), ir_snapshot: structuredClone(body.snapshot) };
      revisions.set(id, saved); retries.set(body.requestId, saved); return saved;
    },
  };
  return { api, calls, revisions, workspace: new DurableWorkspace(api, 60_000) };
}
function gate() { let release!: () => void; const promise = new Promise<void>(resolve => { release = resolve; }); return { promise, release }; }
test('in-flight edits serialize against the new revision and survive switching', async () => {
  const { workspace: w, api, calls, revisions } = setup(); await w.select('a');
  const hold = gate(); const save = api.save; let first = true;
  api.save = async (id, body) => { if (first) { first = false; await hold.promise; } return save(id, body); };
  w.edit(snapshot('first')); const flushing = w.flush(); w.edit(snapshot('second')); hold.release(); await flushing;
  assert.deepEqual(calls.map(c => c.body.baseRevision), ['1', '2']); assert.equal(w.state.revision, '3');
  w.edit(snapshot('before switch')); await w.select('b');
  assert.equal(revisions.get('a')!.ir_snapshot.name, 'before switch'); assert.equal(w.state.projectId, 'b');
  assert.equal(w.state.dirty, false); assert.equal(w.state.undo.length, 0);
});
test('ambiguous response retries exact identity without duplicate revision, then saves later edits', async () => {
  const { workspace: w, api, calls, revisions } = setup(); await w.select('a');
  const save = api.save; let first = true;
  api.save = async (id, body) => { const result = await save(id, body); if (first) { first = false; throw new Error('connection lost'); } return result; };
  w.edit(snapshot('first')); await assert.rejects(w.flush()); assert.equal(w.state.dirty, true);
  w.edit(snapshot('second')); await w.flush();
  assert.deepEqual(calls[0], calls[1]); assert.notEqual(calls[1].body.requestId, calls[2].body.requestId);
  assert.equal(revisions.get('a')!.revision_no, '3'); assert.equal(w.state.project!.name, 'second');
});
test('stale draft blocks switching and never overwrites remote; explicit reload recovers', async () => {
  const { workspace: w, calls, revisions } = setup(); await w.select('a'); w.edit(snapshot('draft'));
  revisions.set('a', { project_id: 'a', revision_no: '2', ir_snapshot: snapshot('remote') });
  await assert.rejects(w.flush()); assert.equal(w.state.saveStatus, 'conflict');
  await assert.rejects(w.select('b')); assert.equal(calls.length, 1); assert.equal(w.state.project!.name, 'draft');
  await w.reloadDiscardingDraft(); assert.equal(w.state.project!.name, 'remote'); assert.equal(w.state.dirty, false);
});
test('logout ignores a late save response; login retry keeps the original request', async () => {
  const { workspace: w, api, calls } = setup(); await w.select('a'); const hold = gate(); const save = api.save;
  api.save = async (id, body) => { const result = await save(id, body); await hold.promise; return result; };
  w.edit(snapshot('draft')); const flushing = w.flush(); w.suspend(); hold.release(); await flushing;
  assert.equal(w.state.revision, '1'); assert.equal(w.state.dirty, true); await w.flush();
  assert.deepEqual(calls[0], calls[1]); assert.equal(w.state.revision, '2'); assert.equal(w.state.dirty, false);
});
test('burst edits debounce to one save; local undo creates another save', async () => {
  const { api, calls } = setup(); const w = new DurableWorkspace(api, 5); await w.select('a');
  w.edit(snapshot('one')); w.edit(snapshot('two')); await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(calls.length, 1); assert.equal(calls[0].body.snapshot.name, 'two');
  w.undo(); await w.flush(); assert.equal(w.state.project!.name, 'one'); assert.equal(w.state.revision, '3');
});
