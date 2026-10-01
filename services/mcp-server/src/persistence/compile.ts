import { randomUUID } from 'node:crypto';
import { sql, type Kysely } from 'kysely';
import { compileWithDiagnostics, COMPILE_VERSION, type CompileReport } from '@plc-ladder-mcp/ladder-ir';
import type { Database } from './database.js';
import { ProjectStoreError } from './projects.js';
export type SavedCompile = CompileReport & {id:string;projectId:string;revision:string;revisionId:string;logicHash:string;startedAt:string};
export class CompileRepository {
  constructor(private db:Kysely<Database>){}
  async run(projectId:string,revision:string,actor:string,requestId:string):Promise<SavedCompile> {
    return this.db.transaction().execute(async trx=>{
      const project=await trx.selectFrom('app.projects').selectAll().where('id','=',projectId).forUpdate().executeTakeFirst();
      if(!project?.current_revision_id)throw new ProjectStoreError('NOT_FOUND');
      const old=await sql<{report:SavedCompile;revision_no:string}>`SELECT v.input_context->'report' AS report, r.revision_no::text FROM app.compile_runs c JOIN app.validation_runs v ON v.id=c.validation_run_id JOIN app.project_revisions r ON r.id=c.project_revision_id WHERE c.project_id=${projectId}::uuid AND c.actor_key=${actor} AND c.request_id=${requestId}`.execute(trx);
      if(old.rows[0]){if(old.rows[0].revision_no!==revision)throw new ProjectStoreError('IDEMPOTENCY_CONFLICT');return old.rows[0].report;}
      const head=await trx.selectFrom('app.project_revisions').selectAll().where('id','=',project.current_revision_id).executeTakeFirstOrThrow();
      if(head.revision_no!==revision)throw new ProjectStoreError('STALE_REVISION',head.revision_no);
      const validationId=randomUUID(),id=randomUUID(),startedAt=new Date().toISOString();
      const report:SavedCompile={...compileWithDiagnostics(head.ir_snapshot),id,projectId,revision,revisionId:head.id,logicHash:head.logic_hash,startedAt};
      await sql`INSERT INTO app.validation_runs (id,project_id,kind,project_revision_id,input_hash,payload_schema_version,validator_version,profile_version,input_context) VALUES (${validationId}::uuid,${projectId}::uuid,'compile',${head.id}::uuid,${head.logic_hash},'0.2',${COMPILE_VERSION},${COMPILE_VERSION},${JSON.stringify({report})}::jsonb)`.execute(trx);
      await sql`INSERT INTO app.compile_runs (id,project_id,project_revision_id,validation_run_id,logic_hash,plc_family,plc_model,capability_version,validator_version,compiler_version,actor_key,request_id) VALUES (${id}::uuid,${projectId}::uuid,${head.id}::uuid,${validationId}::uuid,${head.logic_hash},${head.plc_family},${head.plc_model},${COMPILE_VERSION},${COMPILE_VERSION},${COMPILE_VERSION},${actor},${requestId})`.execute(trx);
      for(const d of report.diagnostics)await sql`INSERT INTO app.validation_diagnostics (id,validation_run_id,code,severity,message,network_id,node_id,path) VALUES (${randomUUID()}::uuid,${validationId}::uuid,${d.code},${d.severity.toUpperCase()},${d.message},${d.networkId??null},${d.nodeId??null},${d.path})`.execute(trx);
      await sql`UPDATE app.validation_runs SET status=${report.status},finished_at=now(),error_count=${report.diagnostics.filter(d=>d.severity==='error').length},warning_count=${report.diagnostics.filter(d=>d.severity==='warning').length} WHERE id=${validationId}::uuid`.execute(trx);
      await sql`UPDATE app.compile_runs SET status=${report.status},finished_at=now() WHERE id=${id}::uuid`.execute(trx);
      await sql`INSERT INTO app.audit_events (id,event_type,actor_type,actor_key,correlation_id,project_id,project_revision_id,validation_run_id,compile_run_id,detail) VALUES (${randomUUID()}::uuid,'compile','human',${actor},${requestId},${projectId}::uuid,${head.id}::uuid,${validationId}::uuid,${id}::uuid,${JSON.stringify({status:report.status})}::jsonb)`.execute(trx);
      return report;
    });
  }
  async history(projectId:string){
    return (await sql<{report:SavedCompile}>`SELECT v.input_context->'report' AS report FROM app.compile_runs c JOIN app.validation_runs v ON v.id=c.validation_run_id WHERE c.project_id=${projectId}::uuid ORDER BY c.started_at DESC,c.id DESC LIMIT 50`.execute(this.db)).rows.map(r=>r.report);
  }
}
