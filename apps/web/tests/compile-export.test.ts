import test from 'node:test';
import assert from 'node:assert/strict';
import {compileWithDiagnostics,locateDiagnostic,vendorArtifact,parseGxWorks2ListText,compileProject,m0ToY0Y5Fixture} from '@plc-ladder-mcp/ladder-ir';
import {demoProject} from '../src/ladder';
test('Compile diagnoses nested wire/device errors at the actual node and keeps warnings non-blocking',()=>{
 const p=structuredClone(demoProject),root=p.programs[0].networks[0].root;if(root.kind!=='series')throw new Error();
 root.children.unshift({kind:'parallel',id:'fork',branches:[{kind:'wire',id:'gap',connected:false},{kind:'contact',id:'bad',mode:'NO',device:{kind:'device',address:'D0'}}]});
 const report=compileWithDiagnostics(p);assert.equal(report.status,'FAIL');assert.deepEqual(report.instructions,[]);assert.ok(report.diagnostics.some(d=>d.nodeId==='gap'&&d.code==='DISCONNECTED_WIRE'));assert.ok(report.diagnostics.some(d=>d.nodeId==='bad'));
 assert.deepEqual(locateDiagnostic(p,'programs[0].networks[0].root.children[0].branches[1]'),{networkId:0,nodeId:'bad'});
 const q=structuredClone(demoProject);if(q.programs[0].networks[0].root.kind==='series')q.programs[0].networks[0].root.children[0]={kind:'wire',id:'connected',connected:true};
 const warning=compileWithDiagnostics(q);assert.equal(warning.status,'PASS');assert.ok(warning.diagnostics.some(d=>d.code==='ALWAYS_ON_OUTPUT'));
});
test('GX export retains Unicode and UTF-16 BOM and round-trips output fanout instructions',()=>{
 const p=structuredClone(m0ToY0Y5Fixture);p.name='ปั๊มน้ำ';const artifact=vendorArtifact(p,'gxworks2');assert.deepEqual([...artifact.bytes.slice(0,2)],[255,254]);
 const text=new TextDecoder('utf-16le').decode(artifact.bytes);assert.ok(text.includes('ปั๊มน้ำ'));
 const imported=parseGxWorks2ListText(text);
 assert.deepEqual(compileProject(imported),compileProject(p));
});
test('SamSoar intermediate adapter preserves wires as conditions and rejects unsupported semantics',()=>{
 const p=structuredClone(demoProject);const artifact=vendorArtifact(p,'samsoar2022');assert.equal(artifact.format,'intermediate-csv');assert.ok(new TextDecoder().decode(artifact.bytes).includes('LD,M0'));
 const root=p.programs[0].networks[0].root;if(root.kind!=='series')throw new Error();if(root.children[0].kind==='contact')root.children[0].edge='rising';
 assert.throws(()=>vendorArtifact(p,'samsoar2022'),/edge contacts/);
});
