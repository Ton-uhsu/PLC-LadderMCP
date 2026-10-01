import { childNodes, containsAction, editStructured, listNodes, type LadderProjectV02, type LogicNode } from '@plc-ladder-mcp/ladder-ir';
import { newElement, readOperand, type NewElement } from './inspector';
export type EditorTool = NewElement | 'nc';
export function toolElement(tool: EditorTool, input: string, id: () => string): LogicNode {
  const node = newElement(tool === 'nc' ? 'contact' : tool, id);
  const tokens = input.trim().toUpperCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) throw new Error('Enter a device or instruction.');
  if (node.kind === 'contact') { node.device.address = tokens[0]; node.mode = tool === 'nc' ? 'NC' : 'NO'; }
  if (node.kind === 'action') {
    if (node.action.kind === 'instruction') {
      node.action.opcode = tool === 'instruction' ? tokens.shift()! : 'OUT';
      node.action.operands = tokens.map(value => /^[KH]/.test(value)
        ? readOperand({ kind: value[0] === 'H' ? 'hex' : 'decimal', value: value.slice(1) }) : readOperand({ kind: 'device', value }));
    } else node.action.device.address = tokens[0];
  }
  if (node.kind !== 'action' || node.action.kind !== 'instruction') if (tokens.length !== 1) throw new Error('Enter one device address.');
  return node;
}
export function insertElement(project: LadderProjectV02, networkId: number, selectedId: string | null, node: LogicNode, position: 'before' | 'after', id: () => string) {
  const root = project.programs[0]?.networks.find(n => n.id === networkId)?.root;
  if (!root) throw new Error('Select a network.');
  const selected = listNodes(root).find(l => l.node.id === selectedId) ?? listNodes(root)[0];
  let branch = selected;
  while (branch.parent && branch.parent.kind !== 'parallel') branch = listNodes(root).find(n => n.node.id === branch.parent!.id)!;
  const outputPlaceholder = branch.parent?.kind === 'parallel' && containsAction(branch.parent) && !containsAction(branch.node);
  if (selected.node.kind === 'wire' && node.kind !== 'wire' && selected.parent && (node.kind !== 'action' || outputPlaceholder)) {
    if (outputPlaceholder && node.kind !== 'action') throw new Error('This is an output branch. Choose a coil or instruction for this cell.');
    const inserted = editStructured(project, networkId, { kind: 'insert', parentId: selected.parent.id, index: selected.index, node });
    const result = editStructured(inserted.project, networkId, { kind: 'remove', nodeId: selected.node.id });
    return { ...result, selectedId: node.id };
  }
  if (node.kind === 'action' && root.kind === 'series') {
    const outputIndex = root.children.findIndex(containsAction);
    if (outputIndex < 0) return editStructured(project, networkId, { kind: 'insert', parentId: root.id, index: root.children.length, node });
    const existing = root.children.slice(outputIndex);
    if (existing.length === 1 && existing[0].kind === 'parallel') return editStructured(project, networkId, { kind: 'insert', parentId: existing[0].id, index: existing[0].branches.length, node });
    let next = project;
    for (const output of [...existing].reverse()) next = editStructured(next, networkId, { kind: 'remove', nodeId: output.id }).project;
    const oldOutput: LogicNode = existing.length === 1 ? existing[0] : { kind: 'series', id: id(), children: existing };
    return { ...editStructured(next, networkId, { kind: 'insert', parentId: root.id, index: outputIndex, node: { kind: 'parallel', id: id(), branches: [oldOutput, node] } }), selectedId: node.id };
  }
  const children = childNodes(selected.node);
  if (children) {
    const index = selected.node.kind === 'series' ? children.findIndex(n => containsAction(n)) : -1;
    return editStructured(project, networkId, { kind: 'insert', parentId: selected.node.id, index: index < 0 ? children.length : index, node });
  }
  if (!selected.parent) throw new Error('Select a series or branch.');
  return editStructured(project, networkId, { kind: 'insert', parentId: selected.parent.id, index: selected.index + (position === 'after' ? 1 : 0), node });
}
