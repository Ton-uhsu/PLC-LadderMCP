import { operandToFxText, childNodes, type LogicNode, type Operand } from '@plc-ladder-mcp/ladder-ir';
export function operandLabel(operand: Operand) {
  return operandToFxText(operand);
}
export function nodeLabel(node: LogicNode): string {
  if (node.kind === "wire") return node.connected ? "Wire" : "Disconnected wire";
  if (node.kind === 'contact') return `${node.mode} ${node.device.address}${node.edge && node.edge !== 'none' ? ` · ${node.edge}` : ''}`;
  if (node.kind === 'action') {
    const a = node.action;
    return a.kind === 'instruction' ? `${a.opcode} ${a.operands.map(operandLabel).join(' ')}`.trim() : `${a.kind === 'coil' ? 'OUT' : a.kind === 'set' ? 'SET' : 'RST'} ${a.device.address}`;
  }
  return node.kind === 'series' ? 'Series' : 'Parallel';
}
export type Placement = { node: LogicNode; x: number; y: number; width: number; height: number };
export type Wire = { x1: number; y1: number; x2: number; y2: number };
export type Layout = { width: number; height: number; nodes: Placement[]; wires: Wire[] };
const lane = 88, gutter = 24;
export function layoutLadder(root: LogicNode, minWidth = 0): Layout {
  const sizes = new Map<string, { width: number; height: number }>();
  function measure(node: LogicNode): { width: number; height: number } {
    const children = childNodes(node);
    let size;
    if (!children || !children.length) size = { width: Math.max(160, nodeLabel(node).length * 8 + 48), height: lane };
    else {
      const items = children.map(measure);
      size = node.kind === 'series'
        ? { width: items.reduce((sum, n) => sum + n.width, 0), height: Math.max(...items.map(n => n.height)) }
        : { width: Math.max(...items.map(n => n.width)) + gutter * 2, height: items.reduce((sum, n) => sum + n.height, 0) };
    }
    sizes.set(node.id, size); return size;
  }
  const size = measure(root);
  function grow(node: LogicNode, extra: number) {
    sizes.get(node.id)!.width += extra;
    const children = childNodes(node);
    if (!children?.length) return;
    if (node.kind === 'series') grow(children.at(-1)!, extra);
    else children.forEach(child => grow(child, extra));
  }
  if (size.width + 100 < minWidth) grow(root, minWidth - size.width - 100);
  const nodes: Placement[] = [], wires: Wire[] = [];
  const wire = (x1: number, y1: number, x2: number, y2: number) => { if (x1 !== x2 || y1 !== y2) wires.push({ x1, y1, x2, y2 }); };
  function place(node: LogicNode, x: number, y: number) {
    const { width, height } = sizes.get(node.id)!;
    nodes.push({ node, x, y, width, height });
    const children = childNodes(node);
    // Empty containers are visibly incomplete; no solid bridge is invented.
    if (!children || !children.length) return;
    if (node.kind === 'series') {
      let cursor = x;
      for (const child of children) { place(child, cursor, y); cursor += sizes.get(child.id)!.width; }
    } else {
      let cursor = y;
      for (const child of children) {
        const childSize = sizes.get(child.id)!;
        wire(x, cursor + lane / 2, x + gutter, cursor + lane / 2);
        place(child, x + gutter, cursor);
        wire(x + gutter + childSize.width, cursor + lane / 2, x + width, cursor + lane / 2);
        cursor += childSize.height;
      }
      const lastY = cursor - sizes.get(children.at(-1)!.id)!.height + lane / 2;
      wire(x, y + lane / 2, x, lastY); wire(x + width, y + lane / 2, x + width, lastY);
    }
  }
  place(root, 50, 32);
  wire(24, 76, 50, 76); wire(50 + size.width, 76, size.width + 76, 76);
  return { width: size.width + 100, height: size.height + 64, nodes, wires };
}
