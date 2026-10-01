import test from 'node:test';
import assert from 'node:assert/strict';
import { m0ToY0Y5Fixture } from '@plc-ladder-mcp/ladder-ir';
import { canonicalJson, snapshotHashes, snapshotSchema } from './snapshot.js';

test('canonical hashing preserves order and ignores only descriptive metadata', () => {
  assert.equal(canonicalJson({ b: 2, a: 1 }), canonicalJson({ a: 1, b: 2 }));
  const before = structuredClone(m0ToY0Y5Fixture);
  const after = structuredClone(before); after.name = 'Renamed'; after.programs[0].networks[0].comment = 'Pump';
  assert.equal(snapshotHashes(before, null).logicHash, snapshotHashes(after, 'gxworks2').logicHash);
  assert.notEqual(snapshotHashes(before, null).contentHash, snapshotHashes(after, null).contentHash);
  after.programs[0].networks[0].root.id = 'different-node';
  assert.notEqual(snapshotHashes(before, null).logicHash, snapshotHashes(after, null).logicHash);
  assert.notEqual(canonicalJson([1, 2]), canonicalJson([2, 1]));
});
test('draft validation allows semantically invalid devices but rejects unknown/duplicate structures', () => {
  const draft = structuredClone(m0ToY0Y5Fixture);
  const root = draft.programs[0].networks[0].root;
  if (root.kind === 'series' && root.children[0].kind === 'contact') root.children[0].device.address = 'X999999';
  assert.doesNotThrow(() => snapshotSchema.parse(draft));
  assert.throws(() => snapshotSchema.parse({ ...draft, unknown: true }));
  draft.programs[0].networks.push(structuredClone(draft.programs[0].networks[0]));
  assert.throws(() => snapshotSchema.parse(draft));
});
