import type { LadderProjectV02, LogicNode } from './v02.js';

export function childNodes(node: LogicNode): LogicNode[] | null {
  return node.kind === 'series' ? node.children : node.kind === 'parallel' ? node.branches : null;
}
export type NodeLocation = { node: LogicNode; parent: LogicNode | null; index: number; depth: number };
export function listNodes(root: LogicNode): NodeLocation[] {
  const result: NodeLocation[] = [];
  function walk(node: LogicNode, parent: LogicNode | null, index: number, depth: number) {
    result.push({ node, parent, index, depth });
    childNodes(node)?.forEach((child, i) => walk(child, node, i, depth + 1));
  }
  walk(root, null, 0, 0); return result;
}
export type StructuredEdit =
  | { kind: 'unwrap'; nodeId: string }
  | { kind: 'insert'; parentId: string; index: number; node: LogicNode }
  | { kind: 'remove'; nodeId: string }
  | { kind: 'move'; nodeId: string; direction: -1 | 1 }
  | { kind: 'update'; nodeId: string; node: LogicNode }
  | { kind: 'wrap'; nodeId: string; containerId: string; group: 'series' | 'parallel'; branchId?: string };

// Edits preserve existing IDs and unrelated networks. Incomplete drafts are allowed;
// semantic validity and export eligibility belong to explicit Compile.
export function editStructured(project: LadderProjectV02, networkId: number, edit: StructuredEdit) {
  const next = structuredClone(project);
  const network = next.programs[0]?.networks.find(n => n.id === networkId);
  if (!network) throw new Error('The selected network no longer exists.');
  const locations = listNodes(network.root);
  const id = edit.kind === 'insert' ? edit.parentId : edit.nodeId;
  const location = locations.find(l => l.node.id === id);
  if (!location) throw new Error('The selected element no longer exists.');
  const { node, parent, index } = location;
  let selectedId = node.id;
  if (edit.kind === 'unwrap') {
    const children = childNodes(node);
    if (children?.length !== 1) throw new Error('Only a single-child group can be unwrapped.');
    if (parent) childNodes(parent)![index] = children[0]; else network.root = children[0];
    selectedId = children[0].id;
  } else if (edit.kind === 'insert') {
    const children = childNodes(node);
    if (!children) throw new Error('Select a series or parallel group to insert an element.');
    if (!Number.isInteger(edit.index) || edit.index < 0 || edit.index > children.length) throw new Error('Invalid insertion position.');
    children.splice(edit.index, 0, structuredClone(edit.node)); selectedId = edit.node.id;
  } else if (edit.kind === 'remove' || edit.kind === 'move') {
    if (!parent) throw new Error('The network root cannot be removed or moved.');
    const siblings = childNodes(parent)!;
    if (edit.kind === 'remove') { siblings.splice(index, 1); selectedId = parent.id; }
    else {
      const destination = index + edit.direction;
      if (destination < 0 || destination >= siblings.length) throw new Error('Element is already at this boundary.');
      [siblings[index], siblings[destination]] = [siblings[destination], siblings[index]];
    }
  } else if (edit.kind === 'update') {
    if (edit.node.id !== node.id || edit.node.kind !== node.kind || childNodes(node)) throw new Error('Inspector edits must preserve element identity and topology.');
    if (node.kind === 'action' && edit.node.kind === 'action' && node.action.id !== edit.node.action.id) throw new Error('Action identity must remain unchanged.');
    const replacement = structuredClone(edit.node);
    if (parent) childNodes(parent)![index] = replacement; else network.root = replacement;
  } else {
    const wrapper: LogicNode = edit.group === 'series'
      ? { kind: 'series', id: edit.containerId, children: [node] }
      : { kind: 'parallel', id: edit.containerId, branches: [node, { kind: 'series', id: edit.branchId ?? '', children: [] }] };
    if (parent) childNodes(parent)![index] = wrapper; else network.root = wrapper;
    selectedId = wrapper.id;
  }
  const ids = new Set<string>();
  for (const program of next.programs) for (const n of program.networks) for (const { node: item } of listNodes(n.root)) {
    for (const key of item.kind === 'action' ? [item.id, item.action.id] : [item.id]) {
      if (!key || ids.has(key)) throw new Error('Every logic/action element requires a unique nonempty identity.');
      ids.add(key);
    }
  }
  return { project: next, selectedId };
}
