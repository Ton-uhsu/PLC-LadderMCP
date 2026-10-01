import type { LadderProjectV02 } from './v02.js';
export type NetworkEdit = { kind: 'add'; rootId: string; comment?: string } |
  { kind: 'delete'; networkId: number } | { kind: 'move'; networkId: number; direction: -1 | 1 } |
  { kind: 'comment'; networkId: number; comment: string };
// Array order is execution order. Numeric identity is never renumbered on move/delete.
export function editNetwork(project: LadderProjectV02, edit: NetworkEdit): { project: LadderProjectV02; selectedId: number } {
  const next = structuredClone(project); const networks = next.programs[0]?.networks;
  if (!networks) throw new Error('Select a project with a Main program.');
  if (edit.kind === 'add') {
    const id = networks.length ? Math.max(...networks.map(n => n.id)) + 1 : 0;
    if (!Number.isSafeInteger(id)) throw new Error('Network identity range exhausted.');
    networks.push({ id, comment: edit.comment ?? '', root: { kind: 'series', id: edit.rootId, children: [] } });
    return { project: next, selectedId: id };
  }
  const index = networks.findIndex(n => n.id === edit.networkId);
  if (index < 0) throw new Error('The selected network no longer exists.');
  if (edit.kind === 'delete') {
    if (networks.length === 1) throw new Error('Keep at least one network in the project.');
    networks.splice(index, 1);
    return { project: next, selectedId: networks[Math.min(index, networks.length - 1)].id };
  }
  if (edit.kind === 'comment') networks[index].comment = edit.comment;
  else {
    const destination = index + edit.direction;
    if (destination < 0 || destination >= networks.length) throw new Error('Network is already at this boundary.');
    [networks[index], networks[destination]] = [networks[destination], networks[index]];
  }
  return { project: next, selectedId: edit.networkId };
}
