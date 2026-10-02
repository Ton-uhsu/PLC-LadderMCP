import type { LogicNode } from '@plc-ladder-mcp/ladder-ir';

// Offsets are measured from the previous branch's first row. Legacy flags
// still represent a completely broken leg; partial edits retain all other cells.
export function setJunctionCell(branch: Extract<LogicNode, {kind: 'series'}>, side: 'leftBreak' | 'rightBreak', offset: number, span: number, broken: boolean) {
  const key = side === 'leftBreak' ? 'leftBreakCells' : 'rightBreakCells';
  const cells = new Set(branch[side] ? Array.from({length: span}, (_, i) => i) : branch[key] ?? []);
  if (broken) cells.add(offset); else cells.delete(offset);
  delete branch[side]; delete branch[key];
  if (cells.size === span) branch[side] = true;
  else if (cells.size) branch[key] = [...cells].sort((a, b) => a - b);
}
