import { operandToFxText, childNodes, containsAction, type LogicNode, type Operand } from '@plc-ladder-mcp/ladder-ir';
export const COLUMN_WIDTH = 120, ROW_HEIGHT = 88, GRID_X = 24, GRID_Y = 32, MIN_COLUMNS = 10;
export function operandLabel(operand: Operand) { return operandToFxText(operand); }
export function nodeLabel(node: LogicNode): string {
  if (node.kind === 'wire') return node.connected ? 'Wire' : node.erased ? 'Empty cell' : 'Disconnected wire';
  if (node.kind === 'contact') return `${node.mode} ${node.device.address}${node.edge && node.edge !== 'none' ? ` · ${node.edge}` : ''}`;
  if (node.kind === 'action') {
    const a = node.action;
    return a.kind === 'instruction' ? `${a.opcode} ${a.operands.map(operandLabel).join(' ')}`.trim() : `${a.kind === 'coil' ? 'OUT' : a.kind === 'set' ? 'SET' : 'RST'} ${a.device.address}`;
  }
  return node.kind === 'series' ? 'Series' : 'Parallel';
}
export type Placement = { node: LogicNode; x: number; y: number; width: number; height: number };
export type Wire = { x1: number; y1: number; x2: number; y2: number };
export type WireSlot = { anchorId?: string; side?: 'before' | 'after'; parentId?: string; index?: number; offset: number; count: number; connected: boolean };
export type GridCell = { row: number; column: number; nodeId?: string; kind: 'node' | 'wire' | 'blank'; connected?: boolean; slot?: WireSlot };
export type Layout = { width: number; height: number; nodes: Placement[]; wires: Wire[]; cells: GridCell[]; columns: number; rows: number };
// Stable integer columns: viewport and label changes never stretch a wire or a contact.
export function layoutLadder(root: LogicNode, _minWidth = 0): Layout {
  let hasOpenDraft = false;
  const sizes = new Map<string, { columns: number; rows: number }>();
  function measure(node: LogicNode): { columns: number; rows: number } {
    if (node.kind === 'series' && node.openEnd) hasOpenDraft = true;
    const children = childNodes(node);
    const items = children?.map(measure) ?? [];
    const size = !items.length ? { columns: node.kind === 'series' && node.openEnd ? 0 : node.kind === 'action' && node.action.kind === 'instruction' ? Math.max(1, Math.ceil((nodeLabel(node).length * 8 + 40) / COLUMN_WIDTH)) : 1, rows: 1 }
      : node.kind === 'series' ? { columns: items.reduce((sum, item) => sum + item.columns, 0), rows: Math.max(...items.map(item => item.rows)) }
      : { columns: Math.max(...items.map(item => item.columns)), rows: items.reduce((sum, item) => sum + item.rows, 0) };
    if (node.kind === 'series' && node.openEnd) size.columns = Math.max(0, size.columns + (node.wireOffset ?? 0));
    sizes.set(node.id, size); return size;
  }
  const size = measure(root);
  function hasOpenRow(node: LogicNode): boolean {
    return node.kind === 'series' && !!node.openEnd || (childNodes(node)?.some(hasOpenRow) ?? false);
  }
  function suffix(node: LogicNode): number {
    if (!containsAction(node) || node.kind === 'action') return 0;
    if (node.kind === 'parallel') return Math.max(0, ...node.branches.map(suffix));
    if (node.kind !== 'series') return 0;
    let count = 0;
    for (const child of [...node.children].reverse()) { if (containsAction(child)) return count + suffix(child); count += sizes.get(child.id)!.columns; }
    return 0;
  }
  const columns = Math.max(MIN_COLUMNS + suffix(root), size.columns + (hasOpenDraft ? 1 : 0)), rows = size.rows;
  const nodes: Placement[] = [], wires: Wire[] = [], cells: GridCell[] = [];
  const x = (column: number) => GRID_X + column * COLUMN_WIDTH, y = (row: number) => GRID_Y + row * ROW_HEIGHT;
  const wire = (x1: number, y1: number, x2: number, y2: number) => { if (x1 !== x2 || y1 !== y2) wires.push({ x1, y1, x2, y2 }); };
  function padding(column: number, row: number, count: number, slot: Omit<WireSlot, 'offset' | 'count'>) {
    for (let i = 0; i < count; i++) {
      cells.push({ column: column + i, row, kind: slot.connected ? 'wire' : 'blank', connected: slot.connected, slot: { ...slot, offset: i, count } });
      if (slot.connected) wire(x(column + i), y(row) + ROW_HEIGHT / 2, x(column + i + 1), y(row) + ROW_HEIGHT / 2);
    }
  }
  function place(node: LogicNode, column: number, row: number, allocated: number, output = false, top = false) {
    const natural = sizes.get(node.id)!, children = childNodes(node);
    const extra = allocated - natural.columns;
    if(node.kind==='series' && node.openEnd) {
      nodes.push({node,x:x(column),y:y(row),width:Math.max(1,natural.columns)*COLUMN_WIDTH,height:natural.rows*ROW_HEIGHT});
      if(children?.length) {
        let current=column+(node.wireOffset??0);for(const child of children){const size=sizes.get(child.id)!;place(child,current,row,size.columns);current+=size.columns;}
      }
      padding(column+natural.columns,row,columns-column-natural.columns,{parentId:node.id,index:node.children.length,connected:false});
      return;
    }
    if (!children?.length) {
      const right = node.kind === 'action' || output && node.kind === 'wire';
      const first = right ? column + extra : column;
      if (extra > 0 && right) padding(column, row, extra, { anchorId: node.id, side: 'before', connected: true });
      nodes.push({ node, x: x(first), y: y(row), width: natural.columns * COLUMN_WIDTH, height: ROW_HEIGHT });
      for (let i = 0; i < natural.columns; i++) cells.push({ column: first + i, row, nodeId: node.id, kind: node.kind === 'wire' ? !node.connected && node.erased ? 'blank' : 'wire' : 'node', ...(node.kind === 'wire' ? { connected: node.connected } : {}) });
      if (extra > 0 && !right) {
        if (children) { padding(first + natural.columns, row, extra, { parentId: node.id, index: 0, connected: false }); for (const cell of cells.filter(c => c.slot?.parentId === node.id)) { cell.slot!.offset++; cell.slot!.count++; } }
        else padding(first + natural.columns, row, extra, { anchorId: node.id, side: 'after', connected: !top });
      }
      return;
    }
    nodes.push({ node, x: x(column), y: y(row), width: allocated * COLUMN_WIDTH, height: natural.rows * ROW_HEIGHT });
    if (node.kind === 'series') {
      let cursor = column;
      const expand = children.findIndex(containsAction);
      const expansion = expand >= 0 ? expand : output ? children.length - 1 : -1;
      for (let i = 0; i < children.length; i++) {
        const child = children[i], count = sizes.get(child.id)!.columns + (i === expansion ? extra : 0);
        place(child, cursor, row, count, output || containsAction(child)); cursor += count;
      }
      if (extra > 0 && expansion < 0) padding(cursor, row, extra, { parentId: node.id, index: children.length, connected: !top && !hasOpenRow(node) });
    } else {
      let cursor = row;
      const trailing = Math.max(0, ...children.map(suffix));
      for (const child of children) {
        const after = output || containsAction(node) ? trailing - suffix(child) : 0;
        place(child, column, cursor, allocated - after, output || containsAction(node));
        if (after && !hasOpenRow(child)) padding(column + allocated - after, cursor, after, {anchorId:child.id,side:'after',connected:true});
        cursor += sizes.get(child.id)!.rows;
      }
      const starts:number[]=[];let branchRow=row;
      for(const child of children){starts.push(branchRow);branchRow+=sizes.get(child.id)!.rows;}
      for(let i=1;i<children.length;i++){
        const above=children[i-1],below=children[i];
        if(!(below.kind==='series' && below.leftBreak))wire(x(column),y(starts[i-1])+ROW_HEIGHT/2,x(column),y(starts[i])+ROW_HEIGHT/2);
        if(!(above.kind==='series' && above.openEnd) && !(below.kind==='series' && (below.openEnd || below.rightBreak)))wire(x(column+allocated),y(starts[i-1])+ROW_HEIGHT/2,x(column+allocated),y(starts[i])+ROW_HEIGHT/2);
      }
    }
  }
  place(root, 0, 0, columns, false, true);
  // Blank cells underneath nested groups have no inferred electrical connection.
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) if (!cells.some(cell => cell.row === row && cell.column === column)) cells.push({ row, column, kind: 'blank' });
  return { width: columns * COLUMN_WIDTH + GRID_X * 2, height: rows * ROW_HEIGHT + GRID_Y * 2, nodes, wires, cells, columns, rows };
}
