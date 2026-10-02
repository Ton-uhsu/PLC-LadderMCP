import React from 'react';
import { childNodes, type LogicNode } from '@plc-ladder-mcp/ladder-ir';
import { COLUMN_WIDTH, ROW_HEIGHT, GRID_X, GRID_Y, layoutLadder, nodeLabel, type GridCell } from './layout';
import { normalizeCellRange, type CellRange } from './cell-selection';

type LadderRendererProps = {
  root: LogicNode;
  diagnosticNodeIds?: string[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onEdit?: (id: string) => void;
  onContextMenu?: (id: string, x: number, y: number) => void;
  onCellEdit?: (cell:GridCell)=>void;
  onCellSelect?: (cell: GridCell, extend: boolean) => void;
  onCellPointerDown?: (cell: GridCell, extend: boolean) => void;
  onCellPointerMove?: (cell: GridCell) => void;
  onCellPointerUp?: () => void;
  cursor?: { row: number; column: number } | null;
  selectionRange?: CellRange | null;
  theme?: 'light' | 'dark';
  minWidth?: number;
};

export function LadderRenderer({ diagnosticNodeIds = [], root, selectedId, onSelect, onEdit, onContextMenu, onCellSelect, onCellEdit, onCellPointerDown, onCellPointerMove, onCellPointerUp, cursor, selectionRange, theme = 'light', minWidth = 0 }: LadderRendererProps) {
  const layout = layoutLadder(root, minWidth);
  const ink = theme === 'dark' ? '#d4dde9' : '#27272a';
  const paper = theme === 'dark' ? '#181c23' : '#f4f4f5';
  const normalizedRange = selectionRange ? normalizeCellRange(selectionRange) : null;
  function cellFromClient(clientX: number, clientY: number, svg: SVGSVGElement) {
    const bounds = svg.getBoundingClientRect();
    const x = (clientX - bounds.left) * layout.width / bounds.width;
    const y = (clientY - bounds.top) * layout.height / bounds.height;
    const column = Math.floor((x - GRID_X) / COLUMN_WIDTH);
    const row = Math.floor((y - GRID_Y) / ROW_HEIGHT);
    return layout.cells.find(cell => cell.row === row && cell.column === column);
  }
  return <div className="ladder-scroll"><svg className="topology-ladder" width={layout.width} height={layout.height} viewBox={`0 0 ${layout.width} ${layout.height}`} aria-label="Ladder topology" role="group" onPointerMove={e => { if (e.buttons !== 1) return; const cell = cellFromClient(e.clientX, e.clientY, e.currentTarget); if (cell) onCellPointerMove?.(cell); }} onPointerUp={onCellPointerUp} onPointerLeave={onCellPointerUp}>
    <title>Ladder topology from canonical IR; select an element to inspect it</title>
    <g stroke={ink} strokeWidth="2" fill="none">
      <line x1="24" y1="20" x2="24" y2={layout.height - 20}/><line x1={layout.width - 24} y1="20" x2={layout.width - 24} y2={layout.height - 20}/>
      {layout.wires.map((w, i) => <line key={i} {...w}/>)}
    </g>
    {layout.cells.filter(cell => !cell.nodeId).map(cell => <g key={`cell-${cell.row}-${cell.column}`} role="button" tabIndex={onCellSelect ? 0 : undefined} aria-label={`${cell.kind === 'wire' ? 'Wire' : 'Empty cell'} row ${cell.row + 1} column ${cell.column}`} data-cell-row={cell.row} data-cell-column={cell.column} onPointerDown={e => { if (e.button !== 0) return; e.preventDefault(); onCellPointerDown?.(cell, e.shiftKey); }} onClick={e => onCellSelect?.(cell, e.shiftKey)} onDoubleClick={()=>onCellEdit?.(cell)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onCellSelect?.(cell, e.shiftKey); } }}>
      <rect x={GRID_X + cell.column * COLUMN_WIDTH} y={GRID_Y + cell.row * ROW_HEIGHT} width={COLUMN_WIDTH} height={ROW_HEIGHT} fill={cursor?.row === cell.row && cursor.column === cell.column ? '#243e61' : 'transparent'} fillOpacity="0.65" stroke={cursor?.row === cell.row && cursor.column === cell.column ? '#60a5fa' : 'transparent'}/>
    </g>)}
    {layout.nodes.map(({ node, x, y, width, height }) => {
      const children = childNodes(node); const selected = cursor ? !children?.length && cursor.row === (y - GRID_Y) / ROW_HEIGHT && cursor.column >= (x - GRID_X) / COLUMN_WIDTH && cursor.column < (x + width - GRID_X) / COLUMN_WIDTH : node.id === selectedId; const center = x + width / 2, baseline = y + 44;
      if(node.kind==='series' && node.openEnd) return diagnosticNodeIds.includes(node.id) ? <rect key={node.id} data-node-id={node.id} className="diagnostic-error-node" x={x+2} y={y+4} width={width-4} height={height-8} fill="none" stroke="#f87171" strokeWidth="2" strokeDasharray="6 4" pointerEvents="none"/> : null;
      if (children?.length) return selected || diagnosticNodeIds.includes(node.id) ? <rect key={node.id} x={x + 2} y={y + 4} width={width - 4} height={height - 8} rx="5" fill="none" stroke={diagnosticNodeIds.includes(node.id) ? "#f87171" : "#2563eb"} strokeWidth="2" strokeDasharray="6 4" pointerEvents="none"/> : null;
      return <g key={node.id} data-node-id={node.id} data-cell-row={(y - GRID_Y) / ROW_HEIGHT} data-cell-column={(x - GRID_X) / COLUMN_WIDTH} data-cell-span={width / COLUMN_WIDTH} role="button" tabIndex={0} aria-label={`${nodeLabel(node)} · ${node.id}`} aria-pressed={selected} onPointerDown={e => { if (e.button !== 0 || !onCellPointerDown) return; const cell = cellFromClient(e.clientX, e.clientY, e.currentTarget.ownerSVGElement!); if (cell) { e.preventDefault(); onCellPointerDown(cell, e.shiftKey); } }} onClick={e => { if (onCellSelect) { const cell = cellFromClient(e.clientX, e.clientY, e.currentTarget.ownerSVGElement!) ?? layout.cells.find(c => c.nodeId === node.id)!; onCellSelect(cell, e.shiftKey); } else onSelect(node.id); }} onDoubleClick={() => onEdit?.(node.id)} onContextMenu={e => { e.preventDefault(); onContextMenu?.(node.id, e.clientX, e.clientY); }} onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onSelect(node.id); if (e.key === 'Enter') onEdit?.(node.id); }
      }} className={diagnosticNodeIds.includes(node.id) ? "ladder-element diagnostic-error-node" : "ladder-element"}>
        <rect x={x + 3} y={y + 3} width={width - 6} height="82" rx="5" fill={selected ? (theme === 'dark' ? '#243e61' : '#dbeafe') : 'transparent'} stroke={diagnosticNodeIds.includes(node.id) ? '#f87171' : selected ? '#2563eb' : 'transparent'}/>
        <title>{`${nodeLabel(node)} · ${node.id}`}</title>
        <g stroke={ink} strokeWidth="2" fill="none">
          <line x1={x} y1={baseline} x2={center - 26} y2={baseline}/><line x1={center + 26} y1={baseline} x2={x + width} y2={baseline}/>
          {node.kind === 'wire' ? node.connected ? <line x1={center - 26} y1={baseline} x2={center + 26} y2={baseline}/> : <><circle cx={center - 26} cy={baseline} r="3" stroke="#f59e0b"/><circle cx={center + 26} cy={baseline} r="3" stroke="#f59e0b"/></> : node.kind === 'contact' ? <>
            <line x1={center - 10} y1={baseline - 14} x2={center - 10} y2={baseline + 14}/><line x1={center + 10} y1={baseline - 14} x2={center + 10} y2={baseline + 14}/>
            <line x1={center - 26} y1={baseline} x2={center - 10} y2={baseline}/><line x1={center + 10} y1={baseline} x2={center + 26} y2={baseline}/>
            {node.mode === 'NC' && <line x1={center - 16} y1={baseline + 18} x2={center + 16} y2={baseline - 18}/>}
          </> : node.kind === 'action' && node.action.kind !== 'instruction' ? <>
            <path d={`M ${center - 8} ${baseline - 16} Q ${center - 24} ${baseline} ${center - 8} ${baseline + 16} M ${center + 8} ${baseline - 16} Q ${center + 24} ${baseline} ${center + 8} ${baseline + 16}`}/>
            <line x1={center - 26} y1={baseline} x2={center - 16} y2={baseline}/><line x1={center + 16} y1={baseline} x2={center + 26} y2={baseline}/>
          </> : <rect x={node.kind === 'action' ? center - Math.max(48, nodeLabel(node).length * 4 + 12) : x + 16} y={baseline - 15} width={node.kind === 'action' ? Math.max(96, nodeLabel(node).length * 8 + 24) : width - 32} height="30" fill={paper} strokeDasharray={children ? '4 3' : undefined}/>}
        </g>
        <text x={center} y={node.kind === 'action' && node.action.kind === 'instruction' || children ? baseline + 5 : y + 20} textAnchor="middle" fill={node.kind === "wire" && !node.connected ? "#f59e0b" : ink} fontFamily="monospace" fontSize="13">{children ? `Empty ${node.kind}` : node.kind === 'wire' ? node.connected ? '' : 'Gap' : nodeLabel(node).length > (width - 16) / 8 ? nodeLabel(node).slice(0, Math.floor((width - 16) / 8) - 1) + '…' : nodeLabel(node)}</text>
        {node.kind === 'contact' && node.edge && node.edge !== 'none' && <text x={center} y={baseline + 5} textAnchor="middle" fill={ink} fontSize="14">{node.edge === 'rising' ? '↑' : '↓'}</text>}
      </g>;
    })}
    {normalizedRange && <rect
      className="cell-range-selection"
      x={GRID_X + normalizedRange.left * COLUMN_WIDTH + 2}
      y={GRID_Y + normalizedRange.top * ROW_HEIGHT + 2}
      width={(normalizedRange.right - normalizedRange.left + 1) * COLUMN_WIDTH - 4}
      height={(normalizedRange.bottom - normalizedRange.top + 1) * ROW_HEIGHT - 4}
      rx="4"
      fill="#2563eb"
      fillOpacity="0.16"
      stroke="#60a5fa"
      strokeWidth="2"
      pointerEvents="none"
    />}
  </svg></div>;
}
