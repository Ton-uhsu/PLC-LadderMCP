import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { editStructured, listNodes, compileProject, generateGxWorks2ListText, parseGxWorks2ListText, m0ToY0Y5Fixture, type LogicNode, type LadderProjectV02 } from '@plc-ladder-mcp/ladder-ir';
import { layoutLadder, nodeLabel } from '../src/editor/layout.ts';
import { newElement, readOperand, operandInput } from '../src/editor/inspector.ts';
import { LadderRenderer } from '../src/editor/LadderRenderer.tsx';
import { DurableWorkspace, type ProjectApi, type Revision } from '../src/persistence/workspace.ts';
const contact = (id: string, address: string): LogicNode => ({ kind: 'contact', id, mode: 'NO', device: { kind: 'device', address } });
const coil: LogicNode = { kind: 'action', id: 'output', action: { kind: 'coil', id: 'coil', device: { kind: 'device', address: 'Y0' } } };
const root: LogicNode = { kind: 'series', id: 'root', children: [
  { kind: 'parallel', id: 'parallel', branches: [contact('x0', 'X0'), { kind: 'series', id: 'nested-series', children: [contact('x1', 'X1'), { kind: 'parallel', id: 'nested-parallel', branches: [contact('m0', 'M0'), contact('m1', 'M1')] }] }] }, coil,
] };
const fixture: LadderProjectV02 = { version: '0.2', name: 'Nested editor fixture', plc: { family: 'Mitsubishi FX', model: 'FX3U' }, programs: [{ name: 'Main', networks: [{ id: 4, root }, { id: 9, root: { kind: 'series', id: 'unrelated', children: [contact('x2', 'X2')] } }] }] };
test('targeted insert/move/update/remove preserves original IDs, operands and unrelated network', () => {
  const original = structuredClone(fixture);
  const added = editStructured(fixture, 4, { kind: 'insert', parentId: 'nested-series', index: 1, node: contact('x3', 'X3') });
  const moved = editStructured(added.project, 4, { kind: 'move', nodeId: 'x3', direction: -1 });
  const changed = editStructured(moved.project, 4, { kind: 'update', nodeId: 'x3', node: { ...contact('x3', 'X4'), mode: 'NC', edge: 'rising' } });
  const series = listNodes(changed.project.programs[0].networks[0].root).find(n => n.node.id === 'nested-series')!.node;
  assert.equal(series.kind, 'series'); if (series.kind !== 'series') throw Error();
  assert.deepEqual(series.children.map(n => n.id), ['x3', 'x1', 'nested-parallel']);
  const deleted = editStructured(changed.project, 4, { kind: 'remove', nodeId: 'x3' });
  assert.deepEqual(deleted.project, fixture); assert.equal(deleted.selectedId, 'nested-series');
  assert.deepEqual(fixture, original);
  assert.deepEqual(changed.project.programs[0].networks[1], fixture.programs[0].networks[1]);
});
test('wrapping keeps the existing subtree; illegal topology/identity edits are atomic', () => {
  const wrapped = editStructured(fixture, 4, { kind: 'wrap', nodeId: 'm0', group: 'parallel', containerId: 'wrapper', branchId: 'draft-branch' });
  const node = listNodes(wrapped.project.programs[0].networks[0].root).find(l => l.node.id === 'wrapper')!.node;
  assert.equal(node.kind, 'parallel'); if (node.kind !== 'parallel') throw Error();
  assert.deepEqual(node.branches[0], contact('m0', 'M0')); assert.equal(node.branches[1].id, 'draft-branch');
  assert.throws(() => editStructured(fixture, 4, { kind: 'insert', parentId: 'root', index: 0, node: contact('x2', 'X3') }), /unique/);
  assert.throws(() => editStructured(fixture, 4, { kind: 'insert', parentId: 'x0', index: 0, node: contact('new', 'X3') }), /group/);
  assert.throws(() => editStructured(fixture, 4, { kind: 'insert', parentId: 'root', index: -1, node: contact('new', 'X3') }), /position/);
  assert.throws(() => editStructured(fixture, 4, { kind: 'remove', nodeId: 'root' }), /root/);
  assert.throws(() => editStructured(fixture, 4, { kind: 'move', nodeId: 'x0', direction: -1 }), /boundary/);
  assert.throws(() => editStructured(fixture, 4, { kind: 'update', nodeId: 'output', node: { ...coil, kind: 'action', action: { kind: 'coil', id: 'changed-id', device: { kind: 'device', address: 'Y1' } } } }), /identity/);
  assert.throws(() => editStructured(fixture, 4, { kind: 'update', nodeId: 'root', node: root }), /topology/);
});
test('nested rendering preserves each leaf and distinct branch paths without rewriting canonical IR', () => {
  const before = JSON.stringify(root); const layout = layoutLadder(root);
  const byId = (id: string) => layout.nodes.find(n => n.node.id === id)!;
  assert.equal(new Set(layout.nodes.map(n => n.node.id)).size, listNodes(root).length);
  assert.ok(byId('x1').y > byId('x0').y); assert.ok(byId('m1').y > byId('m0').y);
  assert.ok(byId('output').x > byId('nested-parallel').x);
  for (const id of ['parallel', 'nested-parallel']) {
    const p = byId(id);
    assert.ok(layout.wires.some(w => w.x1 === p.x && w.x2 === p.x && w.y2 > w.y1));
    assert.ok(layout.wires.some(w => w.x1 === p.x + p.width && w.x2 === p.x + p.width && w.y2 > w.y1));
  }
  const markup = renderToStaticMarkup(createElement(LadderRenderer, { root, selectedId: 'm1', onSelect() {} }));
  for (const id of ['x0', 'x1', 'm0', 'm1', 'output']) assert.ok(markup.includes(`data-node-id="${id}"`));
  assert.ok(markup.includes('aria-pressed="true"')); assert.ok(!markup.includes('NESTED CONDITION'));
  assert.equal(JSON.stringify(root), before);
  const parallelOutputs = layoutLadder(m0ToY0Y5Fixture.programs[0].networks[0].root);
  assert.equal(parallelOutputs.nodes.filter(n => n.node.kind === 'action').length, 6);
});
test('empty drafts remain explicit and operands preserve decimal/hex types and values', () => {
  const empty: LogicNode = { kind: 'parallel', id: 'empty', branches: [] };
  const layout = layoutLadder(empty);
  assert.ok(!layout.wires.some(w => w.x1 === 50 && w.x2 === 50 + layout.nodes[0].width));
  assert.ok(renderToStaticMarkup(createElement(LadderRenderer, { root: empty, selectedId: null, onSelect() {} })).includes('Empty parallel'));
  assert.deepEqual(readOperand({ kind: 'hex', value: 'FF' }), { kind: 'constant', radix: 'hex', value: 255 });
  assert.deepEqual(operandInput(readOperand({ kind: 'decimal', value: '-10' })), { kind: 'decimal', value: '-10' });
  assert.deepEqual(readOperand({ kind: 'device', value: ' d0 ' }), { kind: 'device', address: 'D0' });
  for (const value of ['', '1.5', 'K10', '999999999999999999']) assert.throws(() => readOperand({ kind: 'decimal', value }));
  assert.throws(() => readOperand({ kind: 'hex', value: 'GG' }));
  const instruction: LogicNode = { kind: 'action', id: 'inst', action: { kind: 'instruction', id: 'inner', opcode: 'MOV', operands: [readOperand({ kind: 'hex', value: 'FF' }), readOperand({ kind: 'device', value: 'D0' })] } };
  assert.equal(nodeLabel(instruction), 'MOV HFF D0');
  const project: LadderProjectV02 = { ...fixture, programs: [{ name: 'Main', networks: [{ id: 4, root: { kind: 'series', id: 'hex-root', children: [contact('enable', 'M0'), instruction] } }] }] };
  assert.ok(JSON.stringify(compileProject(project)).includes('HFF D0'));
  const roundTrip = parseGxWorks2ListText(generateGxWorks2ListText(project));
  assert.ok(JSON.stringify(compileProject(roundTrip)).includes('HFF D0'));
  assert.ok(JSON.stringify(roundTrip).includes('"value":255'));
  const edgeProject = structuredClone(project); const edgeRoot = edgeProject.programs[0].networks[0].root;
  if (edgeRoot.kind !== 'series' || edgeRoot.children[0].kind !== 'contact') throw Error();
  edgeRoot.children[0].mode = 'NC'; edgeRoot.children[0].edge = 'rising';
  assert.throws(() => compileProject(edgeProject), /NC edge/);
  edgeRoot.children[0].mode = 'NO'; assert.ok(JSON.stringify(compileProject(edgeProject)).includes('LDP'));
});
test('structured edits undo/redo and autosave preserve IDs independently of explicit compile', async () => {
  let saved: Revision = { project_id: 'a', revision_no: '1', ir_snapshot: structuredClone(fixture) };
  const api: ProjectApi = { list: async () => [], read: async () => saved, create: async () => saved,
    save: async (_, body) => saved = { ...saved, revision_no: String(Number(saved.revision_no) + 1), ir_snapshot: structuredClone(body.snapshot) } };
  const workspace = new DurableWorkspace(api, 60_000); await workspace.select('a');
  const edited = editStructured(workspace.state.project!, 4, { kind: 'wrap', nodeId: 'root', containerId: 'outer', group: 'series' });
  workspace.edit(edited.project); await workspace.flush(); workspace.undo(); await workspace.flush();
  assert.deepEqual(saved.ir_snapshot, fixture); workspace.redo(); await workspace.flush(); assert.deepEqual(saved.ir_snapshot, edited.project);
  const removed = editStructured(edited.project, 4, { kind: 'remove', nodeId: 'root' });
  workspace.edit(removed.project); await workspace.flush(); assert.equal(workspace.state.saveStatus, 'saved');
  assert.throws(() => compileProject(saved.ir_snapshot)); // Stored incomplete draft is not a successful Compile.
  let index = 0;
  for (const kind of ['timer', 'counter'] as const) {
    const node = newElement(kind, () => `generated-${index++}`);
    assert.equal(node.kind, 'action'); if (node.kind !== 'action' || node.action.kind !== 'instruction') throw Error();
    assert.equal(node.action.opcode, 'OUT'); assert.equal(node.action.operands[0].kind, 'device');
  }
});
