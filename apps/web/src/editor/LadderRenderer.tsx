import React from 'react';
import { childNodes, type LogicNode } from '@plc-ladder-mcp/ladder-ir';
import { layoutLadder, nodeLabel } from './layout';
export function LadderRenderer({ root, selectedId, onSelect }: { root: LogicNode; selectedId: string | null; onSelect: (id: string) => void }) {
  const layout = layoutLadder(root);
  return <div className="ladder-scroll"><svg className="topology-ladder" width={layout.width} height={layout.height} viewBox={`0 0 ${layout.width} ${layout.height}`} aria-label="Ladder topology" role="group">
    <title>Ladder topology from canonical IR; select an element to inspect it</title>
    <g stroke="#27272a" strokeWidth="2" fill="none">
      <line x1="24" y1="20" x2="24" y2={layout.height - 20}/><line x1={layout.width - 24} y1="20" x2={layout.width - 24} y2={layout.height - 20}/>
      {layout.wires.map((w, i) => <line key={i} {...w}/>)}
    </g>
    {layout.nodes.map(({ node, x, y, width, height }) => {
      const children = childNodes(node); const selected = node.id === selectedId; const center = x + width / 2, baseline = y + 44;
      if (children?.length) return selected ? <rect key={node.id} x={x + 2} y={y + 4} width={width - 4} height={height - 8} rx="5" fill="none" stroke="#2563eb" strokeWidth="2" strokeDasharray="6 4" pointerEvents="none"/> : null;
      return <g key={node.id} data-node-id={node.id} role="button" tabIndex={0} aria-label={`${nodeLabel(node)} · ${node.id}`} aria-pressed={selected} onClick={() => onSelect(node.id)} onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(node.id); }
      }} className="ladder-element">
        <rect x={x + 3} y={y + 3} width={width - 6} height="82" rx="5" fill={selected ? '#dbeafe' : 'transparent'} stroke={selected ? '#2563eb' : 'transparent'}/>
        <title>{`${nodeLabel(node)} · ${node.id}`}</title>
        <g stroke="#27272a" strokeWidth="2" fill="none">
          <line x1={x} y1={baseline} x2={center - 26} y2={baseline}/><line x1={center + 26} y1={baseline} x2={x + width} y2={baseline}/>
          {node.kind === 'contact' ? <>
            <line x1={center - 10} y1={baseline - 14} x2={center - 10} y2={baseline + 14}/><line x1={center + 10} y1={baseline - 14} x2={center + 10} y2={baseline + 14}/>
            <line x1={center - 26} y1={baseline} x2={center - 10} y2={baseline}/><line x1={center + 10} y1={baseline} x2={center + 26} y2={baseline}/>
            {node.mode === 'NC' && <line x1={center - 16} y1={baseline + 18} x2={center + 16} y2={baseline - 18}/>}
          </> : node.kind === 'action' && node.action.kind !== 'instruction' ? <>
            <path d={`M ${center - 8} ${baseline - 16} Q ${center - 24} ${baseline} ${center - 8} ${baseline + 16} M ${center + 8} ${baseline - 16} Q ${center + 24} ${baseline} ${center + 8} ${baseline + 16}`}/>
            <line x1={center - 26} y1={baseline} x2={center - 16} y2={baseline}/><line x1={center + 16} y1={baseline} x2={center + 26} y2={baseline}/>
          </> : <rect x={x + 16} y={baseline - 15} width={width - 32} height="30" fill="#f4f4f5" strokeDasharray={children ? '4 3' : undefined}/>}
        </g>
        <text x={center} y={node.kind === 'action' && node.action.kind === 'instruction' || children ? baseline + 5 : y + 20} textAnchor="middle" fill="#18181b" fontFamily="monospace" fontSize="13">{children ? `Empty ${node.kind} · draft` : nodeLabel(node)}</text>
        {node.kind === 'contact' && node.edge && node.edge !== 'none' && <text x={center} y={baseline + 5} textAnchor="middle" fill="#18181b" fontSize="14">{node.edge === 'rising' ? '↑' : '↓'}</text>}
      </g>;
    })}
  </svg></div>;
}
