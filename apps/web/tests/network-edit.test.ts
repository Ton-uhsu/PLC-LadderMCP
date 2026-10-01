import test from 'node:test';
import assert from 'node:assert/strict';
import { editNetwork, type LadderProjectV02 } from '@plc-ladder-mcp/ladder-ir';
const project: LadderProjectV02 = { version: '0.2', name: 'Network test', plc: { family: 'Mitsubishi FX', model: 'FX3U' },
  programs: [{ name: 'Main', networks: [7, 2, 19].map(id => ({ id, comment: `Network ${id}`, root: { kind: 'series', id: `root-${id}`, children: [] } })) }] };
test('network movement preserves identity/content and follows array execution order', () => {
  const result = editNetwork(project, { kind: 'move', networkId: 2, direction: -1 });
  assert.deepEqual(result.project.programs[0].networks.map(n => n.id), [2, 7, 19]);
  assert.deepEqual(result.project.programs[0].networks[0], project.programs[0].networks[1]);
  assert.deepEqual(project.programs[0].networks.map(n => n.id), [7, 2, 19]);
  const added = editNetwork(result.project, { kind: 'add', rootId: 'new-root' });
  assert.equal(added.selectedId, 20); assert.equal(added.project.programs[0].networks.at(-1)!.id, 20);
});
test('delete selects surviving neighbor and guards last network/move boundaries', () => {
  const deleted = editNetwork(project, { kind: 'delete', networkId: 19 });
  assert.equal(deleted.selectedId, 2); assert.equal(deleted.project.programs[0].networks.length, 2);
  const single = editNetwork(deleted.project, { kind: 'delete', networkId: 7 });
  assert.throws(() => editNetwork(single.project, { kind: 'delete', networkId: 2 }), /at least one/);
  assert.throws(() => editNetwork(project, { kind: 'move', networkId: 7, direction: -1 }), /boundary/);
  assert.throws(() => editNetwork(project, { kind: 'comment', networkId: 999, comment: 'bad' }), /no longer exists/);
});
