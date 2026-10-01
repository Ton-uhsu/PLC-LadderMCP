import { childNodes, editStructured, listNodes, type LadderProjectV02 } from '@plc-ladder-mcp/ladder-ir';
import { layoutLadder, type GridCell } from './layout';
import { editWire, type WireDirection } from './wire-commands';
export type CellCursor = { row: number; column: number };
export function materializeCell(project: LadderProjectV02, networkId: number, cell: GridCell, id: () => string) {
  if (cell.nodeId) {
    const root=project.programs[0].networks.find(n=>n.id===networkId)!.root;
    const node=listNodes(root).find(n=>n.node.id===cell.nodeId)!.node;
    if(node.kind==='series' && !node.children.length) return editStructured(project,networkId,{kind:'insert',parentId:node.id,index:0,node:{kind:'wire',id:id(),connected:false}});
    return { project, selectedId: cell.nodeId };
  }
  const slot = cell.slot;
  if (!slot) throw new Error('Start this branch with Ctrl+Up/Down from a connected cell.');
  let next = project, parentId = slot.parentId, index = slot.index ?? 0;
  if (slot.anchorId) {
    const root = next.programs[0].networks.find(n => n.id === networkId)!.root;
    const anchor = listNodes(root).find(n => n.node.id === slot.anchorId)!;
    if (anchor.parent?.kind === 'series') { parentId = anchor.parent.id; index = anchor.index + (slot.side === 'after' ? 1 : 0); }
    else {
      parentId = id(); next = editStructured(next, networkId, { kind: 'wrap', nodeId: anchor.node.id, containerId: parentId, group: 'series' }).project;
      index = slot.side === 'after' ? 1 : 0;
    }
  }
  if (!parentId) throw new Error('This cell has no structured insertion position.');
  let selectedId = '';
  const count = slot.connected ? slot.count : slot.offset + 1;
  for (let i = 0; i < count; i++) {
    const nodeId = id(); next = editStructured(next, networkId, { kind: 'insert', parentId, index: index + i, node: { kind: 'wire', id: nodeId, connected: slot.connected } }).project;
    if (i === slot.offset) selectedId = nodeId;
  }
  return { project: next, selectedId };
}
export function editGridWire(project: LadderProjectV02, networkId: number, cursor: CellCursor, direction: WireDirection, id: () => string) {
  const root = project.programs[0]?.networks.find(n => n.id === networkId)?.root;
  if (!root) throw new Error('Select a network.');
  const layout = layoutLadder(root);
  const horizontal = direction === 'left' || direction === 'right';
  const destination = {
    row: cursor.row + (!horizontal ? direction === 'down' ? 1 : -1 : 0),
    column: cursor.column + (horizontal ? direction === 'right' ? 1 : -1 : 0),
  };
  if (destination.column < 0) throw new Error('The cursor is at the left rail.');
  if (!horizontal && (destination.row < 0 || destination.row >= layout.rows)) {
    const source = layout.cells.find(cell => cell.row === cursor.row && cell.column === cursor.column);
    if (!source) throw new Error('Select a cell inside the current rung.');
    let materialized = materializeCell(project, networkId, source, id);
    const sourceNode = listNodes(materialized.project.programs[0].networks.find(n => n.id === networkId)!.root).find(location => location.node.id === materialized.selectedId)!.node;
    if (sourceNode.kind === 'wire' && !sourceNode.connected) {
      materialized = editStructured(materialized.project, networkId, { kind: 'update', nodeId: sourceNode.id, node: { ...sourceNode, connected: true } });
    }
    const existingIds = new Set(listNodes(materialized.project.programs[0].networks.find(n => n.id === networkId)!.root).map(location => location.node.id));
    let result = editWire(materialized.project, networkId, materialized.selectedId, direction, id);
    const addedWire = listNodes(result.project.programs[0].networks.find(n => n.id === networkId)!.root).find(location => location.node.kind === 'wire' && !existingIds.has(location.node.id));
    if (!addedWire || addedWire.node.kind !== 'wire') throw new Error('Unable to extend the rung in that direction.');
    if (!addedWire.node.connected) result = editStructured(result.project, networkId, { kind: 'update', nodeId: addedWire.node.id, node: { ...addedWire.node, connected: true } });
    const nextLayout = layoutLadder(result.project.programs[0].networks.find(n => n.id === networkId)!.root);
    const targetRow = direction === 'up' ? 0 : nextLayout.rows - 1;
    const target = nextLayout.cells.find(cell => cell.row === targetRow && cell.column === Math.min(cursor.column, nextLayout.columns - 1))!;
    return { ...result, selectedId: target.nodeId ?? target.slot?.anchorId ?? target.slot?.parentId ?? addedWire.node.id, cursor: { row: target.row, column: target.column } };
  }
  let cell = layout.cells.find(c => c.row === destination.row && c.column === destination.column);
  if (!cell && destination.column === layout.columns) {
    const source = layout.cells.find(c=>c.row===cursor.row && c.column===cursor.column);
    if(source?.nodeId) cell={...destination,kind:'blank',slot:{anchorId:source.nodeId,side:'after',count:1,offset:0,connected:false}};
    else if(root.kind==='series' && destination.row===0) cell={...destination,kind:'blank',slot:{parentId:root.id,index:root.children.length,count:1,offset:0,connected:false}};
  }
  if (horizontal && cell && !cell.nodeId && !cell.slot) {
    const source = layout.cells.find(candidate => candidate.row === cursor.row && candidate.column === cursor.column);
    if (source?.slot) {
      const materializedSource = materializeCell(project, networkId, source, id);
      return editGridWire(materializedSource.project, networkId, cursor, direction, id);
    }
    if (source?.nodeId) cell = { ...cell, slot: { anchorId: source.nodeId, side: direction === 'right' ? 'after' : 'before', count: 1, offset: 0, connected: false } };
  }
  if (!cell) throw new Error('Select a cell inside the current rung.');
  const materialized = materializeCell(project, networkId, cell, id);
  const node = listNodes(materialized.project.programs[0].networks.find(n => n.id === networkId)!.root).find(n => n.node.id === materialized.selectedId)!.node;
  if (node.kind !== 'wire') throw new Error('This cell contains a symbol. Wire editing does not overwrite contacts or outputs.');
  const result = node.connected
    ? { project: materialized.project, selectedId: node.id }
    : editStructured(materialized.project, networkId, { kind: 'update', nodeId: node.id, node: { ...node, connected: true } });
  return { ...result, cursor: destination };
}
