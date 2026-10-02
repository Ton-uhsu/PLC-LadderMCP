import test from 'node:test';
import assert from 'node:assert/strict';
import type { LadderProjectV02 } from '@plc-ladder-mcp/ladder-ir';
import { compileProject, compileWithDiagnostics } from '@plc-ladder-mcp/ladder-ir';
import { demoProject } from '../src/ladder';
import { editGridWire } from '../src/editor/grid-commands';
import { clearCellRange } from '../src/editor/cell-selection';
import { layoutLadder, GRID_X, GRID_Y, ROW_HEIGHT, COLUMN_WIDTH } from '../src/editor/layout';
import { snapshotSchema, snapshotHashes } from '../../../services/mcp-server/src/persistence/snapshot';
const ids=()=>{let n=0;return()=>`unit-${++n}`;};
const grid=(p:LadderProjectV02)=>layoutLadder(p.programs[0].networks[0].root);
const horizontals=(p:LadderProjectV02)=>new Set(grid(p).cells.filter(c=>c.connected).map(c=>`${c.row}:${c.column}`));
const verticals=(p:LadderProjectV02)=>new Set(grid(p).wires.filter(w=>w.x1===w.x2).map(w=>`${(w.x1-GRID_X)/COLUMN_WIDTH}:${(w.y1-GRID_Y-ROW_HEIGHT/2)/ROW_HEIGHT}`));
const delta=(a:Set<string>,b:Set<string>)=>[...a].filter(x=>!b.has(x)).concat([...b].filter(x=>!a.has(x)));
function nested() {
 const p=structuredClone(demoProject);
 p.programs[0].networks[0].root={kind:'parallel',id:'outer',branches:[{kind:'series',id:'tall',children:[{kind:'wire',id:'prefix',connected:true},{kind:'parallel',id:'inner',branches:[0,1,2].map(i=>({kind:'wire',id:`inner-${i}`,connected:true}))}]},{kind:'series',id:'bottom-row',children:[{kind:'wire',id:'bottom',connected:true}]}]};
 return p;
}
test('Left/Right toggle exactly one existing or blank horizontal cell and retain all symbols',()=>{
 for(const direction of ['left','right'] as const){
  const p=structuredClone(demoProject),id=ids(),at={row:0,column:3};
  const r=editGridWire(p,0,at,direction,id);
  assert.equal(delta(horizontals(p),horizontals(r.project)).length,1);
  assert.deepEqual(r.cursor,{row:0,column:direction==='left'?2:4});
  assert.deepEqual(verticals(r.project),verticals(p));
  const restored=editGridWire(r.project,0,at,direction,id);
  assert.deepEqual(horizontals(restored.project),horizontals(p));
  assert.deepEqual(compileProject(restored.project),compileProject(p));
 }
});
test('drawing left far from an open junction fills only the addressed cell and leaves skipped cells blank',()=>{
 const id=ids(),down=editGridWire(structuredClone(demoProject),0,{row:0,column:5},'down',id);
 const r=editGridWire(down.project,0,{row:1,column:2},'left',id);
 assert.deepEqual(delta(horizontals(down.project),horizontals(r.project)),['1:1']);
 assert.deepEqual(verticals(r.project),verticals(down.project));
 assert.ok(grid(r.project).cells.filter(c=>c.row===1&&c.column>=2).every(c=>!c.connected));
});
test('Up/Down toggle only one cell of a tall vertical junction, persist it, and block Compile until restored',()=>{
 for(const direction of ['up','down'] as const){
  const p=nested(),id=ids(),at={row:direction==='down'?1:2,column:0};
  const r=editGridWire(p,0,at,direction,id);
  assert.deepEqual(delta(verticals(p),verticals(r.project)),['0:1']);
  assert.deepEqual(horizontals(r.project),horizontals(p));
  assert.deepEqual(r.cursor,{row:direction==='down'?2:1,column:0});
  assert.deepEqual(snapshotSchema.parse(r.project),r.project);
  assert.notEqual(snapshotHashes(r.project,null).logicHash,snapshotHashes(p,null).logicHash);
  assert.ok(compileWithDiagnostics(r.project).diagnostics.some(d=>d.code==='DISCONNECTED_JUNCTION'));
  const restored=editGridWire(r.project,0,r.cursor,direction==='up'?'down':'up',id);
  assert.deepEqual(restored.project,p);
 }
});
test('reconnecting a legacy whole broken tall leg restores just the crossed cell',()=>{
 const p=nested(),root=p.programs[0].networks[0].root;
 if(root.kind!=='parallel')throw Error();
 root.branches[1]={kind:'series',id:'broken-bottom',children:[root.branches[1]],leftBreak:true};
 const r=editGridWire(p,0,{row:1,column:0},'down',ids());
 assert.deepEqual(delta(verticals(p),verticals(r.project)),['0:1']);
 assert.ok(compileWithDiagnostics(r.project).diagnostics.some(d=>d.code==='DISCONNECTED_JUNCTION'));
 assert.deepEqual(snapshotSchema.parse(r.project),r.project);
});
test('Delete still addresses one vertical cell after rendering tall legs as individual segments',()=>{
 const p=nested(),cell={row:2,column:0},r=clearCellRange(p,0,{networkId:0,anchor:cell,focus:cell},ids());
 assert.deepEqual(delta(verticals(p),verticals(r.project)),['0:1']);
 assert.deepEqual(snapshotSchema.parse(r.project),r.project);
});
test('a shared nested junction erases one visible cell even when two groups own the stroke',()=>{
 const p=nested(),root=p.programs[0].networks[0].root;
 if(root.kind!=='parallel'||root.branches[0].kind!=='series')throw Error();
 root.branches[0].children.shift();
 const r=editGridWire(p,0,{row:0,column:0},'down',ids());
 assert.deepEqual(delta(verticals(p),verticals(r.project)),['0:0']);
 assert.deepEqual(horizontals(r.project),horizontals(p));
 const restored=editGridWire(r.project,0,r.cursor,'up',ids());
 assert.deepEqual(verticals(restored.project),verticals(p));
 assert.ok(!compileWithDiagnostics(restored.project).diagnostics.some(d=>d.code==='DISCONNECTED_JUNCTION'));
});
test('joining an open row to a tall neighbor adds one vertical cell and advances one row',()=>{
 const p=structuredClone(demoProject);
 p.programs[0].networks[0].root={kind:'series',id:'join-root',children:[{kind:'contact',id:'join-x',mode:'NO',device:{kind:'device',address:'X0'}},{kind:'parallel',id:'join-group',branches:[{kind:'parallel',id:'join-tall',branches:[0,1,2].map(i=>({kind:'wire',id:`join-${i}`,connected:true}))},{kind:'series',id:'join-open',openEnd:true,children:[{kind:'wire',id:'join-bottom',connected:true}]}]},{kind:'action',id:'join-y',action:{kind:'coil',id:'join-coil',device:{kind:'device',address:'Y0'}}}]};
 const r=editGridWire(p,0,{row:3,column:2},'up',ids());
 assert.deepEqual(delta(verticals(p),verticals(r.project)),['2:2']);
 assert.deepEqual(r.cursor,{row:2,column:2});
 assert.deepEqual(horizontals(r.project),horizontals(p));
 assert.deepEqual(snapshotSchema.parse(r.project),r.project);
});
test('Right then Left, and Left then Right, address the same horizontal segment on normal rows',()=>{
 for(const first of ['right','left'] as const){
  const p=structuredClone(demoProject),id=ids(),cursor={row:0,column:4};
  const r=editGridWire(p,0,cursor,first,id);
  const restored=editGridWire(r.project,0,r.cursor,first==='right'?'left':'right',id);
  assert.deepEqual(horizontals(restored.project),horizontals(p));
  assert.deepEqual(restored.cursor,cursor);
 }
});
test('Right on a blank normal row draws the crossed cell; reversing deletes it immediately',()=>{
 const p=structuredClone(demoProject);p.programs[0].networks[0].root={kind:'series',id:'blank-root',children:[]};
 const id=ids(),r=editGridWire(p,0,{row:0,column:3},'right',id);
 assert.deepEqual([...horizontals(r.project)],['0:3']);
 const deleted=editGridWire(r.project,0,r.cursor,'left',id);
 assert.equal(horizontals(deleted.project).size,0);
 assert.deepEqual(deleted.cursor,{row:0,column:3});
});
