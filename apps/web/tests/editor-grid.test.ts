import test from 'node:test';
import assert from 'node:assert/strict';
import { compileProject, listNodes, type LadderProjectV02, validateFx3uV02 } from '@plc-ladder-mcp/ladder-ir';
import { COLUMN_WIDTH, GRID_X, ROW_HEIGHT, layoutLadder } from '../src/editor/layout.ts';
import { editGridWire } from '../src/editor/grid-commands.ts';
import { editWire } from '../src/editor/wire-commands.ts';
import { insertElement, toolElement } from '../src/editor/commands.ts';
import { exportSamSoar } from '../../../services/mcp-server/src/project.ts';
const fixture: LadderProjectV02 = {version:'0.2',name:'Cell editor',plc:{family:'Mitsubishi FX',model:'FX3U'},programs:[{name:'Main',networks:[{id:0,root:{kind:'series',id:'root',children:[{kind:'contact',id:'x',mode:'NO',device:{kind:'device',address:'X0'}},{kind:'action',id:'out',action:{kind:'coil',id:'y',device:{kind:'device',address:'Y0'}}}]}}]}]};
let serial = 0; const id = () => `grid-${serial++}`;
const layout = (p:LadderProjectV02) => layoutLadder(p.programs[0].networks[0].root);
test('one wire/contact occupies one integer column regardless of viewport; directional drawing connects padding wires', () => {
  const original = JSON.stringify(fixture);
  assert.deepEqual(layoutLadder(fixture.programs[0].networks[0].root,600),layoutLadder(fixture.programs[0].networks[0].root,1800));
  const grid=layout(fixture); assert.equal(grid.columns,10);
  assert.equal(grid.nodes.find(n=>n.node.id==='out')!.x,GRID_X+9*COLUMN_WIDTH);
  for(const wire of grid.wires) if(wire.y1===wire.y2) assert.equal(wire.x2-wire.x1,COLUMN_WIDTH);
  const drawn=editGridWire(fixture,0,{row:0,column:3},'right',id);
  const target=layout(drawn.project).nodes.find(n=>n.node.id===drawn.selectedId)!;
  assert.equal(target.width,COLUMN_WIDTH); assert.equal(target.x,GRID_X+4*COLUMN_WIDTH);
  assert.equal(layout(drawn.project).nodes.find(n=>n.node.id==='out')!.x,grid.nodes.find(n=>n.node.id==='out')!.x);
  assert.deepEqual(compileProject(drawn.project),compileProject(fixture));
  const continued=editGridWire(drawn.project,0,{row:0,column:5},'left',id);
  assert.deepEqual(compileProject(continued.project),compileProject(fixture));
  assert.equal(JSON.stringify(fixture),original);
});
test('blank-row drawing adds a single cell per key, including after a coil, without stretching previous wires', () => {
  const empty=structuredClone(fixture); empty.programs[0].networks[0].root={kind:'series',id:'empty',children:[]};
  const first=editGridWire(empty,0,{row:0,column:1},'left',id);
  assert.equal(layout(first.project).cells.find(c=>c.nodeId===first.selectedId)!.column,0);
  const distant=editGridWire(empty,0,{row:0,column:3},'right',id);
  assert.equal(layout(distant.project).cells.find(c=>c.nodeId===distant.selectedId)!.column,4);
  const draft=structuredClone(fixture); const root=draft.programs[0].networks[0].root;
  if(root.kind!=='series') throw Error(); root.children.pop();
  let result=editGridWire(draft,0,{row:0,column:0},'right',id);
  assert.equal(layout(result.project).cells.find(c=>c.nodeId===result.selectedId)!.column,1);
  result=editGridWire(result.project,0,result.cursor,'right',id);
  assert.equal(layout(result.project).cells.find(c=>c.nodeId===result.selectedId)!.column,2);
  assert.equal(listNodes(result.project.programs[0].networks[0].root).filter(n=>n.node.kind==='wire').length,2);
  for(const p of layout(result.project).nodes.filter(n=>n.node.kind==='wire')) assert.equal(p.width,COLUMN_WIDTH);
  const afterCoil=editGridWire(fixture,0,{row:0,column:9},'right',id);
  assert.equal(layout(afterCoil.project).columns,11);
  assert.equal(layout(afterCoil.project).nodes.find(n=>n.node.id==='out')!.x,GRID_X+9*COLUMN_WIDTH);
  assert.deepEqual(compileProject(afterCoil.project),compileProject(fixture));
  assert.throws(()=>editGridWire(fixture,0,{row:0,column:8},'right',id),/contains a symbol/);
});
test('directional drawing connects segments and creates rows beyond the vertical edge', () => {
  const right = editGridWire(fixture, 0, { row: 0, column: 0 }, 'right', id);
  assert.deepEqual(right.cursor, { row: 0, column: 1 });
  assert.ok(listNodes(right.project.programs[0].networks[0].root).filter(location => location.node.kind === 'wire').every(location => location.node.kind === 'wire' && location.node.connected));

  const down = editGridWire(fixture, 0, { row: 0, column: 0 }, 'down', id);
  assert.deepEqual(down.cursor, { row: 1, column: 0 });
  assert.equal(layout(down.project).rows, 2);
  assert.ok(listNodes(down.project.programs[0].networks[0].root).filter(location => location.node.kind === 'wire').every(location => location.node.kind === 'wire' && location.node.connected));

  const across = editGridWire(down.project, 0, down.cursor, 'right', id);
  assert.deepEqual(across.cursor, { row: 1, column: 1 });
  const lower = editGridWire(across.project, 0, across.cursor, 'down', id);
  assert.deepEqual(lower.cursor, { row: 2, column: 1 });
  assert.equal(layout(lower.project).rows, 3);
  const continued = editGridWire(lower.project, 0, lower.cursor, 'right', id);
  assert.deepEqual(continued.cursor, { row: 2, column: 2 });
  assert.ok(listNodes(continued.project.programs[0].networks[0].root).filter(location => location.node.kind === 'wire').every(location => location.node.kind === 'wire' && location.node.connected));

  const up = editGridWire(fixture, 0, { row: 0, column: 0 }, 'up', id);
  assert.deepEqual(up.cursor, { row: 0, column: 0 });
  assert.equal(layout(up.project).rows, 2);
  assert.equal(layout(up.project).cells.find(cell => cell.nodeId === 'x')!.row, 1);
});
test('coil branch can be wired, completed with an output, compiled/exported and cannot delete occupied neighbors', () => {
  const branch=editWire(fixture,0,'out','down',id);
  const gap=listNodes(branch.project.programs[0].networks[0].root).find(n=>n.node.kind==='wire')!.node;
  const gapPlacement=layout(branch.project).nodes.find(n=>n.node.id===gap.id)!;
  assert.equal(gapPlacement.x,GRID_X+9*COLUMN_WIDTH); assert.equal(gapPlacement.width,COLUMN_WIDTH);
  assert.equal(gapPlacement.y-layout(branch.project).nodes.find(n=>n.node.id==='out')!.y,ROW_HEIGHT);
  assert.throws(()=>compileProject(branch.project),/Disconnected/);
  const filled=insertElement(branch.project,0,gap.id,toolElement('coil','Y1',id),'after',id);
  assert.ok(validateFx3uV02(filled.project).valid);
  assert.deepEqual(compileProject(filled.project),[{instruction:'LD',device:'X0'},{instruction:'MPS'},{instruction:'OUT',device:'Y0'},{instruction:'MPP'},{instruction:'OUT',device:'Y1'}]);
  assert.ok(exportSamSoar(filled.project).includes('OUT,Y1'));
  const extended=editGridWire(filled.project,0,{row:1,column:9},'right',id);
  for(const placed of layout(extended.project).nodes.filter(n=>n.node.kind==='action')) assert.equal(placed.x,GRID_X+9*COLUMN_WIDTH);
  assert.deepEqual(compileProject(extended.project),compileProject(filled.project));
  assert.throws(()=>editWire(filled.project,0,'out','down',id),/contains symbols/);
  const continued=editGridWire(filled.project,0,{row:0,column:9},'left',id);
  assert.deepEqual(compileProject(continued.project),compileProject(filled.project));
  const restored=editGridWire(continued.project,0,{row:0,column:7},'right',id);
  assert.deepEqual(compileProject(restored.project),compileProject(filled.project));
  assert.ok(listNodes(restored.project.programs[0].networks[0].root).some(n=>n.node.id==='out' && n.node.kind==='action' && n.node.action.id==='y'));
});

test('Ctrl horizontal draws one block in an empty closed branch and keeps its remaining tail blank',()=>{
 const p=structuredClone(fixture);p.programs[0].networks[0].root={kind:'series',id:'root',children:[{kind:'parallel',id:'group',branches:[{kind:'series',id:'top',children:Array.from({length:6},(_,i)=>({kind:'wire',id:`top-${i}`,connected:true}))},{kind:'series',id:'empty-branch',children:[]}]}]};
 for(const direction of ['left','right'] as const){
  const start={row:1,column:direction==='left'?4:2};
  const r=editGridWire(p,0,start,direction,id),grid=layout(r.project);
  assert.equal(r.cursor.column,start.column+(direction==='left'?-1:1));
  const filled=grid.cells.filter(c=>c.row===1&&c.connected);
  assert.equal(filled.length,1);assert.equal(filled[0].column,r.cursor.column);
  const again=editGridWire(r.project,0,r.cursor,direction,id);
  assert.equal(layout(again.project).cells.filter(c=>c.row===1&&c.connected).length,2);
  assert.equal(layout(again.project).nodes.find(n=>n.node.id==='top-0')!.x,layout(p).nodes.find(n=>n.node.id==='top-0')!.x);
 }
 const first=editGridWire(p,0,{row:1,column:1},'left',id);
 assert.equal(layout(first.project).cells.filter(c=>c.row===1&&c.connected).length,1);
});
