import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { LadderProjectV02, LogicNode } from '@plc-ladder-mcp/ladder-ir';
const device = z.object({ kind: z.literal('device'), address: z.string().min(1) }).strict();
const operand = z.union([device, z.object({ kind: z.literal('constant'), radix: z.enum(['decimal', 'hex']), value: z.number().finite() }).strict()]);
const id = z.string().min(1);
const action = z.union([
  z.object({ kind: z.literal('coil'), id, device }).strict(),
  z.object({ kind: z.literal('set'), id, device }).strict(),
  z.object({ kind: z.literal('reset'), id, device }).strict(),
  z.object({ kind: z.literal('instruction'), id, opcode: z.string().min(1), operands: z.array(operand) }).strict(),
]);
const node: z.ZodType<LogicNode> = z.lazy(() => z.union([
  z.object({ kind: z.literal('wire'), id, connected: z.boolean(), erased: z.boolean().optional() }).strict(),
  z.object({ kind: z.literal('contact'), id, device, mode: z.enum(['NO', 'NC']), edge: z.enum(['none', 'rising', 'falling']).optional() }).strict(),
  z.object({ kind: z.literal('series'), id, children: z.array(node), openEnd: z.boolean().optional(), wireOffset: z.number().int().safe().nonpositive().optional(), leftBreak: z.boolean().optional(), rightBreak: z.boolean().optional(), leftBreakCells: z.array(z.number().int().safe().nonnegative()).optional(), rightBreakCells: z.array(z.number().int().safe().nonnegative()).optional(), rightExtension: z.number().int().safe().positive().optional() }).strict(),
  z.object({ kind: z.literal('parallel'), id, branches: z.array(node) }).strict(),
  z.object({ kind: z.literal('action'), id, action }).strict(),
]));
export const snapshotSchema = z.object({
  version: z.literal('0.2'), name: z.string().min(1),
  plc: z.object({ family: z.literal('Mitsubishi FX'), model: z.literal('FX3U') }).strict(),
  programs: z.array(z.object({ name: z.literal('Main'), networks: z.array(z.object({
    id: z.number().int().nonnegative().safe(), comment: z.string().optional(), root: node,
  }).strict()).min(1) }).strict()).length(1),
}).strict().superRefine((snapshot, ctx) => {
  const networks = new Set<number>(); const nodes = new Set<string>();
  function visit(n: LogicNode) {
    const ids = n.kind === 'action' ? [n.id, n.action.id] : [n.id];
    for (const key of ids) { if (nodes.has(key)) ctx.addIssue({ code: 'custom', message: 'Duplicate node identity' }); nodes.add(key); }
    if (n.kind === 'series') {
      if (n.rightExtension && n.rightExtension >= n.children.length) ctx.addIssue({code:'custom',message:'A right extension must retain the original branch body'});
      n.children.forEach(visit);
    }
    if (n.kind === 'parallel') n.branches.forEach(visit);
  }
  for (const n of snapshot.programs[0].networks) {
    if (networks.has(n.id)) ctx.addIssue({ code: 'custom', message: 'Duplicate network identity' });
    networks.add(n.id); visit(n.root);
  }
});
export const exportTargetSchema = z.enum(['gxworks2', 'samsoar2022']).nullable();
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  return '{' + Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([key, v]) => JSON.stringify(key) + ':' + canonicalJson(v)).join(',') + '}';
}
export function hash(value: unknown) { return createHash('sha256').update(canonicalJson(value)).digest('hex'); }
export function snapshotHashes(ir: LadderProjectV02, target: string | null) {
  return { contentHash: hash({ ir, defaultExportTarget: target }), logicHash: hash({
    version: ir.version, plc: ir.plc, programs: ir.programs.map(p => ({ name: p.name,
      networks: p.networks.map(n => ({ id: n.id, root: n.root })),
    })),
  }) };
}
