import { childNodes, editStructured, listNodes, type LadderProjectV02, type LogicNode } from '@plc-ladder-mcp/ladder-ir';
export type WireDirection = 'left' | 'right' | 'up' | 'down';
const onlyWire = (node: LogicNode): boolean => node.kind === 'wire' || node.kind === 'series' && node.children.every(onlyWire);
export function editWire(project: LadderProjectV02, networkId: number, selectedId: string, direction: WireDirection, id: () => string) {
  const root = project.programs[0]?.networks.find(n => n.id === networkId)?.root;
  if (!root) throw new Error('Select a network.');
  const locations = listNodes(root), selected = locations.find(n => n.node.id === selectedId);
  if (!selected) throw new Error('Select a symbol or wire.');
  const hasAction = (node: LogicNode) => listNodes(node).some(n => n.node.kind === 'action');
  const horizontal = direction === 'left' || direction === 'right';
  if (selected.node.kind === 'action' || selected.node.kind === 'parallel' && hasAction(selected.node)) throw new Error('Draw wires on the condition side of the rung. Output branches require output symbols.');
  if (horizontal) {
    if (selected.node.kind === 'wire') return editStructured(project, networkId, { kind: 'update', nodeId: selected.node.id, node: { ...selected.node, connected: !selected.node.connected } });
    let next = project, parent = selected.parent, index = selected.index;
    if (selected.node.kind === 'series') { parent = selected.node; index = direction === 'left' ? 0 : selected.node.children.findIndex(hasAction); if (index < 0) index = selected.node.children.length; }
    else if (parent?.kind !== 'series') {
      const containerId = id(); const wrapped = editStructured(next, networkId, { kind: 'wrap', nodeId: selected.node.id, containerId, group: 'series' });
      next = wrapped.project; parent = listNodes(next.programs[0].networks.find(n => n.id === networkId)!.root).find(n => n.node.id === containerId)!.node;
      index = 0;
    }
    if (parent?.kind !== 'series') throw new Error('Select a condition or series.');
    const insertion = selected.node.kind === 'series' ? index : index + (direction === 'right' ? 1 : 0);
    const neighbor = parent.children[direction === 'right' ? insertion : insertion - 1];
    if (neighbor?.kind === 'wire') return editStructured(next, networkId, { kind: 'update', nodeId: neighbor.id, node: { ...neighbor, connected: !neighbor.connected } });
    return editStructured(next, networkId, { kind: 'insert', parentId: parent.id, index: insertion, node: { kind: 'wire', id: id(), connected: true } });
  }
  // Nearest enclosing parallel owns the vertical link. Never remove populated branches.
  let branch = selected;
  while (branch.parent && branch.parent.kind !== 'parallel') branch = locations.find(n => n.node.id === branch.parent!.id)!;
  if (branch.parent?.kind === 'parallel') {
    const parallel = branch.parent;
    if (hasAction(parallel)) throw new Error('Output branches require output symbols.');
    const neighborIndex = branch.index + (direction === 'down' ? 1 : -1), neighbor = parallel.branches[neighborIndex];
    if (neighbor) {
      if (!onlyWire(neighbor)) throw new Error('This branch contains symbols. Remove or move them explicitly before removing its line.');
      let result = editStructured(project, networkId, { kind: 'remove', nodeId: neighbor.id });
      if (parallel.branches.length === 2) result = editStructured(result.project, networkId, { kind: 'unwrap', nodeId: parallel.id });
      return { ...result, selectedId: selected.node.id };
    }
    const result = editStructured(project, networkId, { kind: 'insert', parentId: parallel.id, index: direction === 'down' ? branch.index + 1 : branch.index, node: { kind: 'wire', id: id(), connected: false } });
    return { ...result, selectedId: selected.node.id };
  }
  if (!selected.parent) throw new Error('Select a condition or wire before adding a vertical branch.');
  if (hasAction(selected.node)) throw new Error('Select a condition before adding a wire branch.');
  const containerId = id(), branchId = id();
  let result = editStructured(project, networkId, { kind: 'wrap', nodeId: selected.node.id, group: 'parallel', containerId, branchId });
  result = editStructured(result.project, networkId, { kind: 'insert', parentId: branchId, index: 0, node: { kind: 'wire', id: id(), connected: false } });
  if (direction === 'up') result = editStructured(result.project, networkId, { kind: 'move', nodeId: branchId, direction: -1 });
  return { ...result, selectedId: selected.node.id };
}
