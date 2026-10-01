import { randomUUID } from 'node:crypto';
import { sql, type Kysely } from 'kysely';
import type { Database } from './database.js';
import { exportTargetSchema, hash, snapshotHashes, snapshotSchema } from './snapshot.js';

export class ProjectStoreError extends Error {
  constructor(public readonly code: 'NOT_FOUND' | 'STALE_REVISION' | 'IDEMPOTENCY_CONFLICT', public readonly currentRevision?: string) { super(code); }
}
export class ProjectRepository {
  constructor(private readonly db: Kysely<Database>) {}
  async create(snapshot: unknown, actor: string, target: unknown = null) {
    const ir = snapshotSchema.parse(snapshot); const defaultTarget = exportTargetSchema.parse(target);
    return this.db.transaction().execute(async trx => {
      const projectId = randomUUID(); const revisionId = randomUUID();
      await trx.insertInto('app.projects').values({ id: projectId, current_revision_id: null }).execute();
      const hashes = snapshotHashes(ir, defaultTarget);
      const revision = await trx.insertInto('app.project_revisions').values({
        id: revisionId, project_id: projectId, revision_no: '1', parent_revision_id: null, origin: 'initial',
        ir_schema_version: ir.version, ir_snapshot: JSON.stringify(ir), content_hash: hashes.contentHash,
        logic_hash: hashes.logicHash, logic_hash_version: 'v02-1', plc_family: ir.plc.family,
        plc_model: ir.plc.model, default_export_target: defaultTarget, actor_key: actor,
      }).returningAll().executeTakeFirstOrThrow();
      await trx.updateTable('app.projects').set({ current_revision_id: revisionId }).where('id', '=', projectId).execute();
      return revision;
    });
  }
  async list() {
    return this.db.selectFrom('app.projects as p').innerJoin('app.project_revisions as r', 'r.id', 'p.current_revision_id')
      .select(['p.id', 'r.id as revision_id', 'r.revision_no', 'r.created_at', sql<string>`r.ir_snapshot->>'name'`.as('name')])
      .orderBy('p.created_at', 'desc').limit(100).execute();
  }
  async read(projectId: string, revisionNo?: string) {
    let query = this.db.selectFrom('app.project_revisions as r').selectAll('r').where('r.project_id', '=', projectId);
    if (revisionNo) query = query.where('r.revision_no', '=', revisionNo);
    else query = query.innerJoin('app.projects as p', 'p.current_revision_id', 'r.id');
    const row = await query.executeTakeFirst();
    if (!row) throw new ProjectStoreError('NOT_FOUND');
    return row;
  }
  async save(input: { projectId: string; baseRevision: string; snapshot: unknown; actor: string; requestId: string; defaultExportTarget?: unknown }) {
    const ir = snapshotSchema.parse(input.snapshot);
    const target = input.defaultExportTarget === undefined ? undefined : exportTargetSchema.parse(input.defaultExportTarget);
    const requestHash = hash({ baseRevision: input.baseRevision, ir, target });
    return this.db.transaction().execute(async trx => {
      const project = await trx.selectFrom('app.projects').selectAll().where('id', '=', input.projectId).forUpdate().executeTakeFirst();
      if (!project?.current_revision_id) throw new ProjectStoreError('NOT_FOUND');
      const previous = await trx.selectFrom('app.project_save_requests').selectAll()
        .where('project_id', '=', input.projectId).where('actor_key', '=', input.actor).where('request_id', '=', input.requestId).executeTakeFirst();
      if (previous) {
        if (previous.request_hash !== requestHash) throw new ProjectStoreError('IDEMPOTENCY_CONFLICT');
        return trx.selectFrom('app.project_revisions').selectAll().where('id', '=', previous.revision_id).executeTakeFirstOrThrow();
      }
      const head = await trx.selectFrom('app.project_revisions').selectAll().where('id', '=', project.current_revision_id).executeTakeFirstOrThrow();
      if (head.revision_no !== input.baseRevision) throw new ProjectStoreError('STALE_REVISION', head.revision_no);
      const defaultTarget = target === undefined ? head.default_export_target : target;
      const hashes = snapshotHashes(ir, defaultTarget);
      let revision = head;
      if (head.content_hash !== hashes.contentHash) {
        revision = await trx.insertInto('app.project_revisions').values({
          id: randomUUID(), project_id: input.projectId, revision_no: (BigInt(head.revision_no) + 1n).toString(),
          parent_revision_id: head.id, origin: 'manual_autosave', ir_schema_version: ir.version,
          ir_snapshot: JSON.stringify(ir), content_hash: hashes.contentHash, logic_hash: hashes.logicHash,
          logic_hash_version: 'v02-1', plc_family: ir.plc.family, plc_model: ir.plc.model,
          default_export_target: defaultTarget, actor_key: input.actor,
        }).returningAll().executeTakeFirstOrThrow();
        await trx.updateTable('app.projects').set({ current_revision_id: revision.id }).where('id', '=', input.projectId).execute();
      }
      await trx.insertInto('app.project_save_requests').values({ project_id: input.projectId,
        actor_key: input.actor, request_id: input.requestId, request_hash: requestHash, revision_id: revision.id }).execute();
      return revision;
    });
  }
}
