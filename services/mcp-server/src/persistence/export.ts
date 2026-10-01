import {randomUUID,createHash} from 'node:crypto';
import {sql,type Kysely} from 'kysely';
import {vendorArtifact,COMPILE_VERSION,type VendorTarget} from '@plc-ladder-mcp/ladder-ir';
import {ProjectStoreError} from './projects.js';
import type {Database} from './database.js';
export class ExportRepository {
 constructor(private db:Kysely<Database>){}
 async run(projectId:string,input:{revision:string;compileId:string;target:VendorTarget;ideVersion:string;requestId:string},actor:string){
  return this.db.transaction().execute(async trx=>{
   const project=await trx.selectFrom('app.projects').selectAll().where('id','=',projectId).forUpdate().executeTakeFirst();if(!project?.current_revision_id)throw new ProjectStoreError('NOT_FOUND');
   const old=await sql<{id:string;revision_no:string;target:string;compile_run_id:string;ide_version:string;status:string}>`SELECT e.id,r.revision_no::text,e.target,e.compile_run_id,e.ide_version,e.status FROM app.export_events e JOIN app.project_revisions r ON r.id=e.project_revision_id WHERE e.project_id=${projectId}::uuid AND e.actor_key=${actor} AND e.request_id=${input.requestId}`.execute(trx);
   if(old.rows[0]){const e=old.rows[0];if(e.revision_no!==input.revision||e.target!==input.target||e.compile_run_id!==input.compileId||e.ide_version!==input.ideVersion)throw new ProjectStoreError('IDEMPOTENCY_CONFLICT');return this.result(trx,e.id,e.status);}
   const head=await trx.selectFrom('app.project_revisions').selectAll().where('id','=',project.current_revision_id).executeTakeFirstOrThrow();if(head.revision_no!==input.revision)throw new ProjectStoreError('STALE_REVISION',head.revision_no);
   const compile=await sql`SELECT id FROM app.compile_runs WHERE project_id=${projectId}::uuid AND id=${input.compileId}::uuid AND project_revision_id=${head.id}::uuid AND logic_hash=${head.logic_hash} AND status='PASS' AND compiler_version=${COMPILE_VERSION}`.execute(trx);
   if(!compile.rows.length)throw new Error('COMPILE_REQUIRED');
   const id=randomUUID(),validationId=randomUUID(),format=input.target==='gxworks2'?'list-csv':'intermediate-csv';
   await sql`INSERT INTO app.export_events (id,project_id,project_revision_id,compile_run_id,target,ide_version,format,plc_family,plc_model,adapter_version,build_version,actor_key,request_id) VALUES (${id}::uuid,${projectId}::uuid,${head.id}::uuid,${input.compileId}::uuid,${input.target},${input.ideVersion},${format},${head.plc_family},${head.plc_model},${COMPILE_VERSION},${COMPILE_VERSION},${actor},${input.requestId})`.execute(trx);
   await sql`INSERT INTO app.validation_runs (id,project_id,kind,project_revision_id,export_event_id,input_hash,payload_schema_version,validator_version,profile_version) VALUES (${validationId}::uuid,${projectId}::uuid,'adapter',${head.id}::uuid,${id}::uuid,${head.logic_hash},'0.2',${COMPILE_VERSION},${COMPILE_VERSION})`.execute(trx);
   let failure='';let artifact:ReturnType<typeof vendorArtifact>|undefined;try{artifact=vendorArtifact(head.ir_snapshot,input.target);}catch(e){failure=e instanceof Error?e.message:String(e);}
   if(artifact){
    const version=await sql<{id:string}>`INSERT INTO app.export_versions (id,project_id,project_revision_id) VALUES (${randomUUID()}::uuid,${projectId}::uuid,${head.id}::uuid) ON CONFLICT(project_id,project_revision_id) DO NOTHING RETURNING id`.execute(trx);
    const versionId=version.rows[0]?.id??(await sql<{id:string}>`SELECT id FROM app.export_versions WHERE project_id=${projectId}::uuid AND project_revision_id=${head.id}::uuid`.execute(trx)).rows[0].id;
    const bytes=Buffer.from(artifact.bytes),digest=createHash('sha256').update(bytes).digest('hex');
    await sql`INSERT INTO app.export_artifacts (id,export_event_id,project_revision_id,target,ide_version,format,filename,media_type,encoding,content,byte_length,sha256) VALUES (${randomUUID()}::uuid,${id}::uuid,${head.id}::uuid,${input.target},${input.ideVersion},${format},${artifact.filename},${artifact.mediaType},${artifact.encoding},${bytes},${bytes.length},${digest})`.execute(trx);
    await sql`UPDATE app.validation_runs SET status='PASS',finished_at=now() WHERE id=${validationId}::uuid`.execute(trx);
    await sql`UPDATE app.export_events SET status='SUCCESS',finished_at=now(),export_version_id=${versionId}::uuid,adapter_validation_run_id=${validationId}::uuid WHERE id=${id}::uuid`.execute(trx);
   }else{
    await sql`INSERT INTO app.validation_diagnostics(id,validation_run_id,code,severity,message) VALUES (${randomUUID()}::uuid,${validationId}::uuid,'ADAPTER_UNSUPPORTED','ERROR',${failure})`.execute(trx);
    await sql`UPDATE app.validation_runs SET status='FAIL',finished_at=now(),error_count=1 WHERE id=${validationId}::uuid`.execute(trx);
    await sql`UPDATE app.export_events SET status='FAILED',finished_at=now(),adapter_validation_run_id=${validationId}::uuid WHERE id=${id}::uuid`.execute(trx);
   }
   await sql`INSERT INTO app.audit_events (id,event_type,actor_type,actor_key,correlation_id,project_id,project_revision_id,export_event_id,detail) VALUES (${randomUUID()}::uuid,'export','human',${actor},${input.requestId},${projectId}::uuid,${head.id}::uuid,${id}::uuid,${JSON.stringify({status:artifact?'SUCCESS':'FAILED',target:input.target})}::jsonb)`.execute(trx);
   return this.result(trx,id,artifact?'SUCCESS':'FAILED');
  });
 }
 private async result(db:Kysely<Database>,id:string,status:string){
  const artifact=(await sql<{filename:string;media_type:string;encoding:string;content:Uint8Array;sha256:string}>`SELECT filename,media_type,encoding,content,sha256 FROM app.export_artifacts WHERE export_event_id=${id}::uuid`.execute(db)).rows[0];
  const failures=(await sql<{message:string}>`SELECT d.message FROM app.validation_diagnostics d JOIN app.validation_runs v ON v.id=d.validation_run_id WHERE v.export_event_id=${id}::uuid`.execute(db)).rows;
  return {id,status,error:failures.map(d=>d.message).join('; '),artifact:artifact?{filename:artifact.filename,mediaType:artifact.media_type,encoding:artifact.encoding,sha256:artifact.sha256,base64:Buffer.from(artifact.content).toString('base64')}:null};
 }
}
