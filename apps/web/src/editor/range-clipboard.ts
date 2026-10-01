import { childNodes, listNodes, type LadderProjectV02, type LogicNode } from '@plc-ladder-mcp/ladder-ir';
import { clearCellRange, normalizeCellRange, type CellRange, type CellPoint } from './cell-selection';
import { COLUMN_WIDTH, GRID_X, GRID_Y, ROW_HEIGHT, layoutLadder } from './layout';
import { editGridWire, materializeCell } from './grid-commands';
export type RangeClip = { width: number; height: number; subtree?: LogicNode; entries: { row: number; column: number; span: number; node: LogicNode }[]; edges: string[]; origin: string; cut: boolean };
function edges(root: LogicNode, top: number, left: number, height: number, width: number) {
  return layoutLadder(root).wires.filter(w => w.x1 === w.x2).map(w => ({ c: (w.x1-GRID_X)/COLUMN_WIDTH-left, a: (w.y1-GRID_Y-ROW_HEIGHT/2)/ROW_HEIGHT-top, b: (w.y2-GRID_Y-ROW_HEIGHT/2)/ROW_HEIGHT-top }))
    .filter(w => w.c >= 0 && w.c <= width && w.a >= 0 && w.b < height).map(w => `${w.c}:${w.a}:${w.b}`).sort();
}
export function captureRange(project: LadderProjectV02, networkId: number, range: CellRange, origin: string, cut = false): RangeClip {
  const root = project.programs[0].networks.find(n => n.id === networkId)?.root;
  if (!root) throw new Error('Select a network.');
  const box = normalizeCellRange(range), layout = layoutLadder(root), locations = listNodes(root);
  const entries: RangeClip['entries'] = [], seen = new Set<string>();
  for (const cell of layout.cells.filter(c => c.row >= box.top && c.row <= box.bottom && c.column >= box.left && c.column <= box.right).sort((a,b)=>a.row-b.row || a.column-b.column)) {
    if (cell.nodeId) {
      if (seen.has(cell.nodeId)) continue;
      const node = locations.find(l => l.node.id === cell.nodeId)!.node;
      if (childNodes(node)) continue;
      const occupied = layout.cells.filter(c => c.nodeId === cell.nodeId);
      if (occupied.some(c => c.column < box.left || c.column > box.right)) throw new Error('Select the complete instruction, including every column it occupies.');
      entries.push({ row: cell.row-box.top, column: Math.min(...occupied.map(c=>c.column))-box.left, span: occupied.length, node: structuredClone(node) }); seen.add(cell.nodeId);
    } else if (cell.kind === 'wire') entries.push({ row: cell.row-box.top, column: cell.column-box.left, span: 1, node: { kind:'wire', id:`clip-${cell.row}-${cell.column}`, connected: cell.connected ?? true } });
  }
  if (!entries.length) throw new Error('The selected range contains no symbols or wires.');
  const container=layout.nodes.find(p=>childNodes(p.node) && p.x===GRID_X+box.left*COLUMN_WIDTH && p.y===GRID_Y+box.top*ROW_HEIGHT && p.width===(box.right-box.left+1)*COLUMN_WIDTH && p.height===(box.bottom-box.top+1)*ROW_HEIGHT);
  return {subtree:container?structuredClone(container.node):undefined,width:box.right-box.left+1,height:box.bottom-box.top+1,entries,edges:edges(root,box.top,box.left,box.bottom-box.top+1,box.right-box.left+1),origin,cut};
}
export function cutRange(project: LadderProjectV02, networkId: number, range: CellRange, origin: string, id: ()=>string) {
  const clip = captureRange(project,networkId,range,origin,true);
  return {...clearCellRange(project,networkId,range,id),clip};
}
export function pasteRange(project: LadderProjectV02, networkId: number, at: CellPoint, clip: RangeClip, origin: string, id: ()=>string) {
  let next = structuredClone(project);
  const root = () => next.programs[0].networks.find(n=>n.id===networkId)!.root;
  if (!next.programs[0].networks.some(n=>n.id===networkId)) throw new Error('Select a network.');
  const initial = layoutLadder(root());
  const destinationGroup=clip.subtree ? initial.nodes.find(p=>childNodes(p.node) && p.x===GRID_X+at.column*COLUMN_WIDTH && p.y===GRID_Y+at.row*ROW_HEIGHT && ((p.width===clip.width*COLUMN_WIDTH && p.height===clip.height*ROW_HEIGHT) || at.row===0 && at.column===0 && p.node===root() && childNodes(p.node)!.length===0) && listNodes(p.node).every(l=>childNodes(l.node)!==null || l.node.kind==='wire')) : undefined;
  if(clip.subtree && destinationGroup){
    const fragment=structuredClone(clip.subtree);
    const existing=new Set(next.programs.flatMap(p=>p.networks.flatMap(n=>listNodes(n.root).flatMap(l=>l.node.kind==='action'?[l.node.id,l.node.action.id]:[l.node.id]))));
    for(const {node} of listNodes(fragment)){if(!(clip.cut && clip.origin===origin && !existing.has(node.id)))node.id=id();if(node.kind==='action' && !(clip.cut && clip.origin===origin && !existing.has(node.action.id)))node.action.id=id();}
    const network=next.programs[0].networks.find(n=>n.id===networkId)!;
    const target=listNodes(root()).find(l=>l.node.id===destinationGroup.node.id)!;
    if(target.parent)childNodes(target.parent)![target.index]=fragment;
    else network.root=fragment.kind==='series'?fragment:{kind:'series',id:id(),children:[fragment]};
    const rendered=layoutLadder(network.root);
    for(const entry of clip.entries){
      const actual=rendered.cells.find(c=>c.row===at.row+entry.row && c.column===at.column+entry.column);
      if(!actual || actual.kind!== (entry.node.kind==='wire'?'wire':'node'))throw new Error('Paste changes the allocation of the selected subtree. Copy the complete rung.');
    }
    if(JSON.stringify(edges(root(),at.row,at.column,clip.height,clip.width))!==JSON.stringify(clip.edges))throw new Error('The copied branch cannot retain its grid allocation here.');
    for(const p of initial.nodes.filter(p=>!childNodes(p.node)&&p.node.kind!=='wire')){const after=rendered.nodes.find(n=>n.node.id===p.node.id);if(!after || after.x!==p.x || after.y!==p.y)throw new Error('Paste would move an existing symbol.');}
    return {project:next,selectedId:fragment.id};
  }
  const before = initial.nodes.filter(p=>!childNodes(p.node) && p.node.kind!=='wire').map(p=>({id:p.node.id,x:p.x,y:p.y}));
  for(const item of clip.entries) for(let i=0;i<item.span;i++) {
    const cell=initial.cells.find(c=>c.row===at.row+item.row && c.column===at.column+item.column+i);
    if(cell?.nodeId && (()=>{const n=listNodes(root()).find(l=>l.node.id===cell.nodeId)?.node;return n && n.kind!=='wire' && !(childNodes(n)?.length===0);})()) throw new Error('Paste would overwrite a symbol. Clear the destination first.');
  }
  const existing = new Set(next.programs.flatMap(p=>p.networks.flatMap(n=>listNodes(n.root).flatMap(l=>l.node.kind==='action'?[l.node.id,l.node.action.id]:[l.node.id]))));

  const placed: {id:string;row:number;column:number;span:number}[]=[];
  for(const item of clip.entries) {
    const point={row:at.row+item.row,column:at.column+item.column};
    let layout=layoutLadder(root());
    while(point.row>=layout.rows) {
      const grown=editGridWire(next,networkId,{row:layout.rows-1,column:Math.min(point.column,layout.columns-1)},'down',id); next=grown.project; layout=layoutLadder(root());
    }
    let cell=layout.cells.find(c=>c.row===point.row && c.column===point.column);
    if(!cell) throw new Error('Paste extends beyond the grid. Draw destination cells first.');
    if(!cell.nodeId && !cell.slot) throw new Error('Draw a connected destination branch before pasting here.');
    const materialized=materializeCell(next,networkId,cell,id); next=materialized.project;
    const location=listNodes(root()).find(l=>l.node.id===materialized.selectedId)!;
    if(location.node.kind!=='wire') throw new Error('Paste would overwrite a symbol. Clear the destination first.');
    const node=structuredClone(item.node);
    if(!(clip.cut && clip.origin===origin && !existing.has(node.id)))node.id=id();
    if(node.kind==='action' && !(clip.cut && clip.origin===origin && !existing.has(node.action.id)))node.action.id=id();
    if(!location.parent) throw new Error('Paste requires a series-root network.');
    const siblings=childNodes(location.parent)!;
    // A wide instruction replaces its full destination span, not just the first cell.
    if(item.span>1) {
      const targetLayout=layoutLadder(root());
      const ids=new Set(targetLayout.cells.filter(c=>c.row===point.row && c.column>=point.column && c.column<point.column+item.span).map(c=>c.nodeId));
      for(let j=item.span-1;j>0;j--) {
        const padding=targetLayout.cells.find(c=>c.row===point.row && c.column===point.column+j);
        if(!padding?.nodeId) throw new Error('Draw all destination cells for this instruction first.');
      }
      const run=siblings.slice(location.index,location.index+item.span);
      if(run.length!==item.span || run.some(n=>n.kind!=='wire'||!ids.has(n.id))) throw new Error('Instruction destination crosses a branch boundary.');
      siblings.splice(location.index,item.span,node);
    } else siblings[location.index]=node;
    placed.push({id:node.id,...point,span:item.span});
  }
  const result=layoutLadder(root());
  for(const p of placed) {
    const cells=result.cells.filter(c=>c.nodeId===p.id);
    if(cells.length!==p.span || cells.some(c=>c.row!==p.row) || Math.min(...cells.map(c=>c.column))!==p.column) throw new Error('This paste would move cells because of the rung topology. Draw a matching destination branch or paste into an empty network.');
  }
  for(const p of before) { const after=result.nodes.find(n=>n.node.id===p.id); if(!after || after.x!==p.x || after.y!==p.y) throw new Error('Paste would move an existing symbol. Use an empty destination.'); }
  if(JSON.stringify(edges(root(),at.row,at.column,clip.height,clip.width))!==JSON.stringify(clip.edges)) throw new Error('Destination branch connections differ from the copied range. Draw matching branches first.');
  const ids=next.programs.flatMap(p=>p.networks.flatMap(n=>listNodes(n.root).flatMap(l=>l.node.kind==='action'?[l.node.id,l.node.action.id]:[l.node.id])));
  if(new Set(ids).size!==ids.length) throw new Error('Clipboard identities collide.');
  return {project:next,selectedId:placed[0].id};
}
