import {
  editStructured,
  listNodes,
  type LadderProjectV02,
} from '@plc-ladder-mcp/ladder-ir';
import { materializeCell } from './grid-commands';
import { layoutLadder } from './layout';

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
    if (wire?.kind !== 'wire' || !wire.connected) continue;
    next = editStructured(next, networkId, {
      kind: 'update',
      nodeId: wire.id,
      node: { ...wire, connected: false },
    }).project;
    changed = true;
  }

  for (const wireId of explicitWires) {
    const currentRoot = next.programs[0].networks.find((candidate) => candidate.id === networkId)!.root;
    const wire = listNodes(currentRoot).find((candidate) => candidate.node.id === wireId)?.node;
    if (wire?.kind !== 'wire' || !wire.connected) continue;
    next = editStructured(next, networkId, {
      kind: 'update',
      nodeId: wire.id,
      node: { ...wire, connected: false },
    }).project;
    changed = true;
  }

  for (const nodeId of removableNodes) {
    const currentRoot = next.programs[0].networks.find((candidate) => candidate.id === networkId)!.root;
    if (!listNodes(currentRoot).some((candidate) => candidate.node.id === nodeId && candidate.parent)) continue;
    next = editStructured(next, networkId, { kind: 'remove', nodeId }).project;
    changed = true;
  }

  if (!changed) return { project, selectedId: network.root.id, changed: false };
  const selectedId = next.programs[0].networks.find((candidate) => candidate.id === networkId)!.root.id;
  return { project: next, selectedId, changed: true };
}
