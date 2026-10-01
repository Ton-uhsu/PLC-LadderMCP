import test from 'node:test';
import assert from 'node:assert/strict';
import {Kysely,PGliteDialect,sql} from 'kysely';
import {PGlite} from '@electric-sql/pglite';
import {m0ToY0Y5Fixture} from '@plc-ladder-mcp/ladder-ir';
import type {Database} from './database.js';
import {ProjectRepository} from './projects.js';
import {migrateDatabase} from './test-support/migrations.js';
test('saved Compile and retained export pin exact revisions, reject stale gates and deduplicate retries',async()=>{
 const db=new Kysely<Database>({dialect:new PGliteDialect({pglite:new PGlite({parsers:{20:v=>v}})})});
 try{
  await migrateDatabase(db);const repository=new ProjectRepository(db),initial=await repository.create(m0ToY0Y5Fixture,'admin');
  const run=await repository.compile(initial.project_id,'1','admin','compile-1');assert.equal(run.status,'PASS');assert.ok(run.instructions.length);
  assert.deepEqual(await repository.compile(initial.project_id,'1','admin','compile-1'),run);
  const input={revision:'1',compileId:run.id,target:'gxworks2' as const,ideVersion:'test-version',requestId:'export-1'};
  const exported=await repository.export(initial.project_id,input,'admin');assert.equal(exported.status,'SUCCESS');assert.ok(exported.artifact?.base64);
  assert.deepEqual(await repository.export(initial.project_id,input,'admin'),exported);
  await assert.rejects(repository.export(initial.project_id,{...input,target:'samsoar2022'},'admin'),{code:'IDEMPOTENCY_CONFLICT'});
  const repeat=await repository.export(initial.project_id,{...input,requestId:'export-repeat'},'admin');assert.equal(repeat.status,'SUCCESS');
  assert.equal((await sql`SELECT id FROM app.export_versions`.execute(db)).rows.length,1);
  const unsupported=structuredClone(m0ToY0Y5Fixture);const unsupportedRoot=unsupported.programs[0].networks[0].root;
  if(unsupportedRoot.kind!=='series')throw new Error();unsupportedRoot.children[0]={kind:'contact',id:'edge',mode:'NO',edge:'rising',device:{kind:'device',address:'M0'}};
  const other=await repository.create(unsupported,'admin');const edgeRun=await repository.compile(other.project_id,'1','admin','edge-compile');
  assert.equal(edgeRun.status,'PASS');const failedExport=await repository.export(other.project_id,{...input,compileId:edgeRun.id,target:'samsoar2022',requestId:'unsupported-export'},'admin');
  assert.equal(failedExport.status,'FAILED');assert.equal(failedExport.artifact,null);assert.match(failedExport.error,/edge contacts/);
  const changed=structuredClone(m0ToY0Y5Fixture);const root=changed.programs[0].networks[0].root;if(root.kind!=='series')throw new Error();root.children.unshift({kind:'wire',id:'gap',connected:false});
  await repository.save({projectId:initial.project_id,baseRevision:'1',actor:'admin',requestId:'save-2',snapshot:changed});
  await assert.rejects(repository.compile(initial.project_id,'1','admin','compile-stale'),{code:'STALE_REVISION'});
  await assert.rejects(repository.export(initial.project_id,{...input,revision:'2',requestId:'stale-export'},'admin'),/COMPILE_REQUIRED/);
  const fail=await repository.compile(initial.project_id,'2','admin','compile-2');assert.equal(fail.status,'FAIL');assert.ok(fail.diagnostics.some(d=>d.nodeId==='gap'));
  const history=await repository.compileHistory(initial.project_id);assert.equal(history.length,2);assert.ok(history.some(r=>r.revision==='1' && r.status==='PASS'));
  await assert.rejects(sql`UPDATE app.compile_runs SET actor_key='tamper' WHERE id=${run.id}::uuid`.execute(db),/Sealed/);
  assert.equal((await sql`SELECT id FROM app.export_artifacts`.execute(db)).rows.length,2);
 }finally{await db.destroy();}
});
