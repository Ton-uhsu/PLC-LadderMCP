import test from 'node:test';
import assert from 'node:assert/strict';
import { demoProject } from '../src/ladder';
import { captureRange, cutRange, pasteRange } from '../src/editor/range-clipboard';
import { layoutLadder } from '../src/editor/layout';
import { listNodes } from '@plc-ladder-mcp/ladder-ir';
const ids=()=>{let n=0;return()=>`fresh-${++n}`;};
function fixture(){const p=structuredClone(demoProject);p.programs[0].networks.push({id:1,root:{kind:'series',id:'empty-root',children:[]}});return p;}
test('rectangular Copy/Paste preserves cells including projected wires and new identities',()=>{
 const p=fixture(),clip=captureRange(p,0,{anchor:{row:0,column:0},focus:{row:0,column:9}},'one');
 const result=pasteRange(p,1,{row:0,column:0},clip,'one',ids());
 const cells=layoutLadder(result.project.programs[0].networks[1].root).cells;
 assert.equal(cells.find(c=>c.nodeId&&listNodes(result.project.programs[0].networks[1].root).find(n=>n.node.id===c.nodeId)?.node.kind==='action')?.column,9);
 const all=result.project.programs[0].networks.flatMap(n=>listNodes(n.root).map(l=>l.node.id));assert.equal(new Set(all).size,all.length);
 assert.deepEqual(p,fixture());
});
test('Cut preserves vacated coordinates and same-project move preserves symbol identities',()=>{
 const p=fixture(),result=cutRange(p,0,{anchor:{row:0,column:0},focus:{row:0,column:9}},'one',ids());
 assert.ok(layoutLadder(result.project.programs[0].networks[0].root).cells.every(c=>c.kind==='blank'&&c.connected===false));
 const moved=pasteRange(result.project,1,{row:0,column:0},result.clip,'one',(()=>{let n=100;return()=>`paste-${++n}`;})());
 assert.ok(listNodes(moved.project.programs[0].networks[1].root).some(l=>l.node.id==='e1'));
});
test('collisions are rejected atomically, including symbols under projected wires',()=>{
 const p=fixture(),before=structuredClone(p),clip=captureRange(p,0,{anchor:{row:0,column:0},focus:{row:0,column:9}},'one');
 assert.throws(()=>pasteRange(p,0,{row:0,column:0},clip,'one',ids()),/overwrite/);assert.deepEqual(p,before);
});
test('partial wide instruction cannot be copied',()=>{
 const p=fixture();p.programs[0].networks[0].root={kind:'series',id:'wide-root',children:[{kind:'action',id:'wide',action:{kind:'instruction',id:'wide-action',opcode:'MOV',operands:[{kind:'constant',radix:'decimal',value:100000},{kind:'device',address:'D1000'}]}}]};
 const cell=layoutLadder(p.programs[0].networks[0].root).cells.find(c=>c.nodeId==='wide')!;
 assert.throws(()=>captureRange(p,0,{anchor:cell,focus:cell},'one'),/complete instruction/);
});
test('full rectangular nested rung Copy/Paste retains branch topology in an empty network',()=>{
 const p=fixture();const root=p.programs[0].networks[0].root;
 if(root.kind!=='series')throw new Error();root.children[1]={kind:'parallel',id:'outputs',branches:[root.children[1],{kind:'action',id:'second',action:{kind:'coil',id:'second-action',device:{kind:'device',address:'Y1'}}}]};
 const clip=captureRange(p,0,{anchor:{row:0,column:0},focus:{row:1,column:9}},'one');
 const result=pasteRange(p,1,{row:0,column:0},clip,'one',ids());
 assert.deepEqual(layoutLadder(result.project.programs[0].networks[1].root).wires,layoutLadder(root).wires);
});
test('clearing an output cell preserves its column and wires outside the selection',()=>{
 const p=fixture();const result=cutRange(p,0,{anchor:{row:0,column:9},focus:{row:0,column:9}},'one',ids());
 const cells=layoutLadder(result.project.programs[0].networks[0].root).cells;
 assert.equal(cells.find(c=>c.column===9)?.connected,false);
 assert.equal(cells.find(c=>c.column===8)?.connected,true);
 assert.equal(cells.find(c=>c.column===0)?.nodeId,'e1');
});
