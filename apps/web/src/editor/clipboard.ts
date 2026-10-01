import { create } from 'zustand';
import { listNodes, type LadderProjectV02, type LogicNode } from '@plc-ladder-mcp/ladder-ir';
import { insertElement } from './commands';

export type EditorClip = { node: LogicNode; network: boolean; comment?: string; cut: boolean; origin: string };
// Session-only structured clipboard. Never contains credentials or authoritative state.
export const useEditorClipboard = create<{ clip: EditorClip | null; set: (clip: EditorClip) => void }>(set => ({ clip: null, set: clip => set({ clip }) }));
export function captureSelection(project: LadderProjectV02, networkId: number, nodeId: string, origin: string, cut = false): EditorClip {
  const network = project.programs[0].networks.find(n => n.id === networkId);
  const selected = network && listNodes(network.root).find(n => n.node.id === nodeId);
  if (!selected) throw new Error('Select an element or network.');
  if (cut && !selected.parent) throw new Error('Use Delete network for a whole network. Copy or Duplicate can create another network.');
  return { node: structuredClone(selected.node), network: !selected.parent, comment: network?.comment, origin, cut };
}
export function pasteSelection(project: LadderProjectV02, networkId: number, selectedId: string, clip: EditorClip, origin: string, position: 'before' | 'after', id: () => string) {
  const node = structuredClone(clip.node);
  const existing = new Set(project.programs[0].networks.flatMap(n => listNodes(n.root).flatMap(l => l.node.kind === 'action' ? [l.node.id, l.node.action.id] : [l.node.id])));
  const incoming = listNodes(node).flatMap(l => l.node.kind === 'action' ? [l.node.id, l.node.action.id] : [l.node.id]);
  const preserve = clip.cut && clip.origin === origin && incoming.every(value => !existing.has(value));
  if (!preserve) for (const { node: item } of listNodes(node)) { item.id = id(); if (item.kind === 'action') item.action.id = id(); }
  if (clip.network) {
    const next = structuredClone(project), networks = next.programs[0].networks;
    const index = networks.findIndex(n => n.id === networkId);
    if (index < 0) throw new Error('Select a network.');
    const newId = Math.max(...networks.map(n => n.id)) + 1;
    if (!Number.isSafeInteger(newId)) throw new Error('Network ID limit reached.');
    networks.splice(index + 1, 0, { id: newId, root: node, ...(clip.comment === undefined ? {} : { comment: clip.comment }) });
    const identities = networks.flatMap(n => listNodes(n.root).flatMap(l => l.node.kind === 'action' ? [l.node.id, l.node.action.id] : [l.node.id]));
    if (new Set(identities).size !== identities.length || identities.some(value => !value.trim())) throw new Error('Element IDs must be unique and nonempty.');
    return { project: next, selectedId: node.id, networkId: newId };
  }
  return insertElement(project, networkId, selectedId, node, position, id);
}
