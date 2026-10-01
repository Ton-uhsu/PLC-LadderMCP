import type { IncomingMessage, ServerResponse } from 'node:http';
import { z } from 'zod';
import { ProjectRepository, ProjectStoreError } from './projects.js';
const uuid = z.string().uuid();
const revision = z.string().regex(/^[1-9][0-9]*$/).refine(v => BigInt(v) <= 9223372036854775807n);
const requestSchema = z.object({ baseRevision: revision, requestId: z.string().min(1).max(200), snapshot: z.unknown(), defaultExportTarget: z.unknown().optional() }).strict();
async function readBody(req: IncomingMessage) {
  const chunks: Buffer[] = []; let length = 0;
  for await (const chunk of req) {
    length += Buffer.byteLength(chunk); if (length > 2 * 1024 * 1024) throw new Error('PAYLOAD_TOO_LARGE');
    chunks.push(Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export async function handleProjectPersistence(req: IncomingMessage, res: ServerResponse, store: ProjectRepository, actor: string) {
  const url = new URL(req.url ?? '/', 'http://localhost');
  function send(status: number, body: unknown) { res.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': process.env.CORS_ORIGIN ?? '*' }); res.end(JSON.stringify(body)); }
  try {
    const parts = url.pathname.split('/').filter(Boolean).slice(3);
    if (parts.length === 0 && req.method === 'GET') { send(200, await store.list()); return; }
    if (parts.length === 0 && req.method === 'POST') {
      const body = z.object({ snapshot: z.unknown(), defaultExportTarget: z.unknown().optional() }).strict().parse(await readBody(req));
      send(201, await store.create(body.snapshot, actor, body.defaultExportTarget)); return;
    }
    const projectId = uuid.parse(parts[0]);
    if(parts.length===2 && parts[1]==='export' && req.method==='POST'){
      const body=z.object({revision,compileId:uuid,target:z.enum(['gxworks2','samsoar2022']),ideVersion:z.string().min(1).max(100),requestId:z.string().min(1).max(200)}).strict().parse(await readBody(req));
      send(200,await store.export(projectId,body,actor));return;
    }
    if(parts.length===2 && parts[1]==='compile' && req.method==='POST'){
      const body=z.object({revision,requestId:z.string().min(1).max(200)}).strict().parse(await readBody(req));
      send(200,await store.compile(projectId,body.revision,actor,body.requestId));return;
    }
    if(parts.length===2 && parts[1]==='compile' && req.method==='GET'){send(200,await store.compileHistory(projectId));return;}
    if (parts.length === 1 && req.method === 'GET') { send(200, await store.read(projectId)); return; }
    if (parts.length === 3 && parts[1] === 'revisions' && req.method === 'GET') {
      send(200, await store.read(projectId, revision.parse(parts[2]))); return;
    }
    if (parts.length === 1 && req.method === 'POST') {
      const body = requestSchema.parse(await readBody(req));
      send(200, await store.save({ projectId, actor, baseRevision: body.baseRevision, snapshot: body.snapshot, defaultExportTarget: body.defaultExportTarget, requestId: body.requestId })); return;
    }
    send(404, { error: 'NOT_FOUND' });
  } catch (error) {
    if (error instanceof ProjectStoreError) send(error.code === 'NOT_FOUND' ? 404 : 409, { error: error.code, currentRevision: error.currentRevision });
    else if (error instanceof Error && error.message === 'COMPILE_REQUIRED') send(409,{error:'COMPILE_REQUIRED'});
    else if (error instanceof z.ZodError || error instanceof SyntaxError) send(400, { error: 'INVALID_REQUEST' });
    else if (error instanceof Error && error.message === 'PAYLOAD_TOO_LARGE') send(413, { error: 'PAYLOAD_TOO_LARGE' });
    else send(503, { error: 'PERSISTENCE_UNAVAILABLE' });
  }
}
