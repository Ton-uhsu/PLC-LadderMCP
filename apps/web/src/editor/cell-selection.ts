import {
  editStructured,
  childNodes,
  listNodes,
  type LadderProjectV02,
} from '@plc-ladder-mcp/ladder-ir';
import { materializeCell } from './grid-commands';
import { layoutLadder, GRID_X, GRID_Y, COLUMN_WIDTH, ROW_HEIGHT } from './layout';

export type CellPoint = { row: number; column: number };
export type CellRange = { anchor: CellPoint; focus: CellPoint };
export type NormalizedCellRange = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

export function normalizeCellRange(range: CellRange): NormalizedCellRange {
  return {
    top: Math.min(range.anchor.row, range.focus.row),
    bottom: Math.max(range.anchor.row, range.focus.row),
    left: Math.min(range.anchor.column, range.focus.column),
    right: Math.max(range.anchor.column, range.focus.column),
  };
}

export function rangeCellCount(range: CellRange | NormalizedCellRange): number {
  const normalized = 'anchor' in range ? normalizeCellRange(range) : range;
  return (normalized.bottom - normalized.top + 1) * (normalized.right - normalized.left + 1);
}

export function cellIsInRange(point: CellPoint, range: CellRange): boolean {
  const normalized = normalizeCellRange(range);
  return point.row >= normalized.top
    && point.row <= normalized.bottom
    && point.column >= normalized.left
    && point.column <= normalized.right;
}

export function clearCellRange(
  project: LadderProjectV02,
  networkId: number,
  range: CellRange,
  id: () => string,
): { project: LadderProjectV02; selectedId: string; changed: boolean } {
  const network = project.programs[0]?.networks.find((candidate) => candidate.id === networkId);
  if (!network) throw new Error('The selected network no longer exists.');

  const layout = layoutLadder(network.root);
  const locations = listNodes(network.root);
  const selectedCells = layout.cells.filter((cell) => cellIsInRange(cell, range));
  const projectedWires: CellPoint[] = [];
  const explicitWires = new Set<string>();
  const removableNodes = new Set<string>();

  for (const cell of selectedCells) {
    if (!cell.nodeId) {
      if (cell.kind === 'wire' && cell.connected) projectedWires.push(cell);
      continue;
    }
    const location = locations.find((candidate) => candidate.node.id === cell.nodeId);
    if (!location || !location.parent) continue;
    if (location.node.kind === 'wire') explicitWires.add(location.node.id);
    else removableNodes.add(location.node.id);
  }

  let next = project;
  let changed = false;

  // Pin output padding before deleting its symbol, so losing containsAction does not
  // pull its replacement gap left and collapse columns outside the selection.
  for (const nodeId of removableNodes) {
    const symbol = locations.find(candidate => candidate.node.id === nodeId)?.node;
    if (symbol?.kind !== 'action') continue;
    const occupied = layout.cells.filter(cell => cell.nodeId === nodeId);
    for (const padding of layout.cells.filter(cell => !cell.nodeId && cell.slot?.connected && occupied.some(at => at.row === cell.row && cell.column < at.column))) {
      const currentRoot = next.programs[0].networks.find(candidate => candidate.id === networkId)!.root;
      const cell = layoutLadder(currentRoot).cells.find(candidate => candidate.row === padding.row && candidate.column === padding.column);
      if (cell && !cell.nodeId && cell.slot) next = materializeCell(next,networkId,cell,id).project;
    }
  }
  // Materialize padding before removing symbols, while its original grid coordinates are stable.
  for (const point of projectedWires) {
    const currentNetwork = next.programs[0].networks.find((candidate) => candidate.id === networkId)!;
    const cell = layoutLadder(currentNetwork.root).cells.find(
      (candidate) => candidate.row === point.row && candidate.column === point.column,
    );
    if (!cell || cell.kind !== 'wire' || cell.connected === false) continue;

    const materialized = materializeCell(next, networkId, cell, id);
    next = materialized.project;
    const currentRoot = next.programs[0].networks.find((candidate) => candidate.id === networkId)!.root;
    const wire = listNodes(currentRoot).find((candidate) => candidate.node.id === materialized.selectedId)?.node;
    if (wire?.kind !== 'wire' || !wire.connected && wire.erased) continue;
    next = editStructured(next, networkId, {
      kind: 'update',
      nodeId: wire.id,
      node: { ...wire, connected: false, erased: true },
    }).project;
    changed = true;
  }

  for (const wireId of explicitWires) {
    const currentRoot = next.programs[0].networks.find((candidate) => candidate.id === networkId)!.root;
    const wire = listNodes(currentRoot).find((candidate) => candidate.node.id === wireId)?.node;
    if (wire?.kind !== 'wire' || !wire.connected && wire.erased) continue;
    next = editStructured(next, networkId, {
      kind: 'update',
      nodeId: wire.id,
      node: { ...wire, connected: false, erased: true },
    }).project;
    changed = true;
  }

  for (const nodeId of removableNodes) {
    const currentRoot = next.programs[0].networks.find((candidate) => candidate.id === networkId)!.root;
    if (!listNodes(currentRoot).some((candidate) => candidate.node.id === nodeId && candidate.parent)) continue;
    // Keep the vacated cells in place so Cut/Paste cannot collapse the grid.
    const span = layout.cells.filter(cell => cell.nodeId === nodeId).length;
    next = structuredClone(next);
    const nextRoot = next.programs[0].networks.find(candidate => candidate.id === networkId)!.root;
    const target = listNodes(nextRoot).find(candidate => candidate.node.id === nodeId)!;
    const gaps = Array.from({length: Math.max(1, span)}, () => ({kind: 'wire' as const, id: id(), connected: false, erased: true}));
    const siblings = childNodes(target.parent!)!;
    if (target.parent!.kind === 'series') siblings.splice(target.index, 1, ...gaps);
    else siblings[target.index] = gaps.length === 1 ? gaps[0] : {kind:'series',id:id(),children:gaps};
    changed = true;
  }

  // A fully erased block has no remaining vertical junctions either.
  const bounds=normalizeCellRange(range);
  for(const placed of layout.nodes.filter(p=>p.node.kind==='parallel')){
    const left=(placed.x-GRID_X)/COLUMN_WIDTH,top=(placed.y-GRID_Y)/ROW_HEIGHT;
    if(left<bounds.left || left+placed.width/COLUMN_WIDTH-1>bounds.right || top<bounds.top || top+placed.height/ROW_HEIGHT-1>bounds.bottom)continue;
    const currentRoot=next.programs[0].networks.find(n=>n.id===networkId)!.root;
    const group=listNodes(currentRoot).find(l=>l.node.id===placed.node.id)?.node;
    if(group?.kind!=='parallel')continue;
    const leaves=listNodes(group).filter(l=>!childNodes(l.node));
    if(!leaves.every(l=>l.node.kind==='wire' && !l.node.connected && l.node.erased))continue;
    if(group.branches.slice(1).every(n=>n.kind==='series' && n.leftBreak && n.rightBreak))continue;
    next=structuredClone(next);
    const target=listNodes(next.programs[0].networks.find(n=>n.id===networkId)!.root).find(l=>l.node.id===group.id)!.node;
    if(target.kind==='parallel')for(let i=1;i<target.branches.length;i++){
      const branch=target.branches[i];target.branches[i]=branch.kind==='series'?{...branch,leftBreak:true,rightBreak:true}:{kind:'series',id:id(),children:[branch],leftBreak:true,rightBreak:true};
    }
    changed=true;
  }
  if (!changed) return { project, selectedId: network.root.id, changed: false };
  const selectedId = next.programs[0].networks.find((candidate) => candidate.id === networkId)!.root.id;
  return { project: next, selectedId, changed: true };
}
