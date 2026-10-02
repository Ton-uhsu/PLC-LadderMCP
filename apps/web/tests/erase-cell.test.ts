import test from 'node:test';
import assert from 'node:assert/strict';
import {demoProject} from '../src/ladder';
import {clearCellRange} from '../src/editor/cell-selection';
import {layoutLadder} from '../src/editor/layout';
import {editGridWire} from '../src/editor/grid-commands';
import {listNodes,compileWithDiagnostics} from '@plc-ladder-mcp/ladder-ir';
import {snapshotSchema} from '../../../services/mcp-server/src/persistence/snapshot';
const id=(()=>{let n=0;return()=>`erase-${++n}`;})();
test('one Delete clears a legacy Gap and does not require a second edit; redraw restores a real wire',()=>{
 const p=structuredClone(demoProject);p.programs[0].networks[0].root={kind:'series',id:'root',children:[{kind:'wire',id:'legacy',connected:false},{kind:'action',id:'output',action:{kind:'coil',id:'coil',device:{kind:'device',address:'Y0'}}}]};
 const range={anchor:{row:0,column:0},focus:{row:0,column:0}};
 const cleared=clearCellRange(p,0,range,id);assert.equal(cleared.changed,true);
 const cell=layoutLadder(cleared.project.programs[0].networks[0].root).cells[0];assert.equal(cell.kind,'blank');
 assert.equal(clearCellRange(cleared.project,0,range,id).changed,false);
 assert.deepEqual(snapshotSchema.parse(cleared.project),cleared.project);
 assert.equal(compileWithDiagnostics(cleared.project).status,'FAIL');
 const redrawn=editGridWire(cleared.project,0,{row:0,column:1},'left',id);
 assert.equal(layoutLadder(redrawn.project.programs[0].networks[0].root).cells.find(c=>c.column===0)?.kind,'wire');
 assert.deepEqual(listNodes(p.programs[0].networks[0].root).find(l=>l.node.id==='legacy')?.node,{kind:'wire',id:'legacy',connected:false});
});
test('Delete clears all wires and both vertical legs of an entire selected branch block',()=>{
 const p=structuredClone(demoProject);p.programs[0].networks[0].root={kind:'series',id:'root',children:[{kind:'parallel',id:'branch',branches:[{kind:'wire',id:'top',connected:false},{kind:'wire',id:'bottom',connected:false}]}]};
 const result=clearCellRange(p,0,{anchor:{row:0,column:0},focus:{row:1,column:9}},id),layout=layoutLadder(result.project.programs[0].networks[0].root);
 assert.equal(result.changed,true);assert.equal(layout.wires.length,0);assert.equal(layout.rows,2);assert.ok(layout.cells.every(c=>c.kind==='blank'));
});
