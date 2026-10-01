import test from 'node:test';
import assert from 'node:assert/strict';
import {demoProject} from '../src/ladder';
import {enterAtCell} from '../src/editor/cursor-input';
import {layoutLadder} from '../src/editor/layout';
import {listNodes} from '@plc-ladder-mcp/ladder-ir';
const ids=()=>{let n=0;return()=>`cursor-${++n}`;};
test('overwrite preserves contact identity and unrelated output coordinates',()=>{
 const p=structuredClone(demoProject),cell=layoutLadder(p.programs[0].networks[0].root).cells.find(c=>c.column===0)!;
 const result=enterAtCell(p,0,cell,cell.nodeId!,{kind:'contact',id:'new',mode:'NC',device:{kind:'device',address:'X2'}},'overwrite','after',ids());
 assert.equal(result.selectedId,cell.nodeId);assert.equal(listNodes(result.project.programs[0].networks[0].root).filter(l=>l.node.kind==='contact').length,1);
 assert.equal(layoutLadder(result.project.programs[0].networks[0].root).cells.find(c=>c.nodeId==='action-e2')?.column,9);assert.deepEqual(p,demoProject);
});
test('overwrite at a projected wire inserts at that coordinate without a disconnected gap',()=>{
 const p=structuredClone(demoProject),cell=layoutLadder(p.programs[0].networks[0].root).cells.find(c=>c.column===1)!;
 const result=enterAtCell(p,0,cell,null,{kind:'contact',id:'new',mode:'NO',device:{kind:'device',address:'X1'}},'overwrite','after',ids());
 assert.equal(layoutLadder(result.project.programs[0].networks[0].root).cells.find(c=>c.nodeId==='new')?.column,1);
 assert.ok(!listNodes(result.project.programs[0].networks[0].root).some(l=>l.node.kind==='wire'&&!l.node.connected));
});
