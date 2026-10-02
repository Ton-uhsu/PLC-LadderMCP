import { childNodes, editStructured, listNodes, type LadderProjectV02 } from '@plc-ladder-mcp/ladder-ir';
import { layoutLadder, COLUMN_WIDTH, GRID_X, GRID_Y, ROW_HEIGHT, type GridCell } from './layout';
import { type WireDirection } from './wire-commands';
import { setJunctionCell } from './junction-segments';
export type CellCursor = { row: number; column: number };
export function materializeCell(project: LadderProjectV02, networkId: number, cell: GridCell, id: () => string) {
  if (cell.nodeId) {
    const root=project.programs[0].networks.find(n=>n.id===networkId)!.root;
    const node=listNodes(root).find(n=>n.node.id===cell.nodeId)!.node;
    if(node.kind==='series' && !node.children.length) {
      const padding = layoutLadder(root).cells.filter(c => c.slot?.parentId === node.id);
      const location = listNodes(root).find(l => l.node.id === node.id)!;
      const count = location.parent?.kind === 'parallel' && !node.openEnd ? Math.max(1, ...padding.map(c => c.slot!.count)) : 1;
      let next = project, selectedId = '';
      for (let i = 0; i < count; i++) {
        const nodeId = id();
        next = editStructured(next,networkId,{kind:'insert',parentId:node.id,index:i,node:{kind:'wire',id:nodeId,connected:false,erased:true}}).project;
        if (i === 0) selectedId = nodeId;
      }
      return {project:next,selectedId};
    }
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
  // Preserve the entire blank allocation before inserting a wire. Otherwise
  // layout infers connected padding from the new leaf and fills the rest of a branch.
  const currentRoot = next.programs[0].networks.find(n => n.id === networkId)!.root;
  const locations = listNodes(currentRoot);
  let owner = locations.find(l => l.node.id === parentId);
  let closedBranch = false;
  while (owner) {
    if (owner.node.kind === 'series' && owner.node.openEnd) break;
    if (owner.parent?.kind === 'parallel') { closedBranch = true; break; }
    owner = owner.parent ? locations.find(l => l.node.id === owner!.parent!.id) : undefined;
  }
  const count = slot.connected || closedBranch ? slot.count : slot.offset + 1;
  for (let i = 0; i < count; i++) {
    const nodeId = id(); next = editStructured(next, networkId, { kind: 'insert', parentId, index: index + i, node: { kind: 'wire', id: nodeId, connected: slot.connected, ...(!slot.connected ? {erased:true} : {}) } }).project;
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
  if (!horizontal) {
    const placements=layout.nodes;
    const locations=listNodes(root);
    const source=layout.cells.find(c=>c.row===cursor.row && c.column===cursor.column);
    const upper=Math.min(cursor.row,destination.row),lower=upper+1,x=GRID_X+cursor.column*COLUMN_WIDTH;
    const segment=layout.wires.some(w=>w.x1===x && w.x2===x && Math.min(w.y1,w.y2)<=GRID_Y+upper*ROW_HEIGHT+ROW_HEIGHT/2 && Math.max(w.y1,w.y2)>=GRID_Y+lower*ROW_HEIGHT+ROW_HEIGHT/2);
    // A break lives on the lower row, so Up and Down address the same undirected segment.
    const junctions=placements.filter(p=>p.node.kind==='parallel' && (x===p.x || x===p.x+p.width)).sort((a,b)=>a.height-b.height);
    // Nested groups can share a visible stroke. Remove/restore that one
    // geometric interval in every owner without touching neighboring intervals.
    let editedProject=project,editedId='';
    for(const group of junctions){
      if(group.node.kind!=='parallel')continue;
      let row=(group.y-GRID_Y)/ROW_HEIGHT;
      for(let i=1;i<group.node.branches.length;i++){
        const above=group.node.branches[i-1],child=group.node.branches[i];
        const span=(placements.find(p=>p.node.id===above.id)?.height??ROW_HEIGHT)/ROW_HEIGHT;
        const end=row+span;
        if(upper>=row && lower<=end){
          const side=x===group.x?'leftBreak':'rightBreak';
          const key=side==='leftBreak'?'leftBreakCells':'rightBreakCells';
          const broken=child.kind==='series' && (child[side] || child[key]?.includes(upper-row));
          const available=side==='leftBreak' || !(above.kind==='series' && above.openEnd) && !(child.kind==='series' && child.openEnd);
          if(available && (segment ? !broken : broken)){
            const next=structuredClone(editedProject),parallel=listNodes(next.programs[0].networks.find(n=>n.id===networkId)!.root).find(l=>l.node.id===group.node.id)!.node;
            if(parallel.kind!=='parallel')throw new Error('Select a branch junction.');
            let branch=parallel.branches[i];
            if(branch.kind!=='series'){branch={kind:'series',id:id(),children:[branch]};parallel.branches[i]=branch;}
            setJunctionCell(branch,side,upper-row,span,segment);
            editedProject=next;editedId=branch.id;
          }
        }
        row=end;
      }
    }

    if(editedId)return {project:editedProject,selectedId:editedId,cursor:destination};

    const emptyBranch=locations.find(l=>l.node.id===source?.slot?.parentId && l.node.kind==='series' && l.node.openEnd);
    const firstEmptyCell=emptyBranch && layout.cells.find(c=>c.row===cursor.row && c.slot?.parentId===emptyBranch.node.id);
    const open=placements.filter(p=>p.node.kind==='series' && p.node.openEnd && (p.y-GRID_Y)/ROW_HEIGHT===cursor.row && (p.x-GRID_X)/COLUMN_WIDTH<=cursor.column).at(-1)
      ?? (emptyBranch && firstEmptyCell ? {node:emptyBranch.node,x:GRID_X+firstEmptyCell.column*COLUMN_WIDTH,y:GRID_Y+cursor.row*ROW_HEIGHT,width:0,height:ROW_HEIGHT} : undefined);
    const owner=open && locations.find(l=>l.node.id===open.node.id);
    if(owner?.parent?.kind==='parallel') {
      const group=placements.find(p=>p.node.id===owner.parent!.id)!;
      const neighbor=owner.parent.branches[owner.index+(direction==='down'?1:-1)];
      if(neighbor){
        const end=(group.x+group.width-GRID_X)/COLUMN_WIDTH;
        if(cursor.column===end && !(neighbor.kind==='series' && neighbor.openEnd)){
          if(open!.node.kind==='series' && open!.node.wireOffset)throw new Error('The left extension is an open wire end. Connect its topology before Compile/Export.');
          const start=(group.x-GRID_X)/COLUMN_WIDTH;
          if(!layout.cells.filter(c=>c.row===cursor.row && c.column>=start && c.column<end).every(c=>c.kind==='node' || c.kind==='wire' && c.connected))throw new Error('Complete the horizontal branch before joining its end.');
          const next=structuredClone(project),branch=listNodes(next.programs[0].networks.find(n=>n.id===networkId)!.root).find(l=>l.node.id===owner.node.id)!.node;
          if(branch.kind==='series')delete branch.openEnd;
          const upperBranch=owner.parent.branches[Math.min(owner.index,owner.index+(direction==='down'?1:-1))];
          const upperPlacement=placements.find(p=>p.node.id===upperBranch.id)!;
          const startRow=(upperPlacement.y-GRID_Y)/ROW_HEIGHT,span=upperPlacement.height/ROW_HEIGHT;
          const lowerIndex=Math.max(owner.index,owner.index+(direction==='down'?1:-1));
          const targetGroup=listNodes(next.programs[0].networks.find(n=>n.id===networkId)!.root).find(l=>l.node.id===owner.parent!.id)!.node;
          if(targetGroup.kind==='parallel' && span>1){
            let lowerBranch=targetGroup.branches[lowerIndex];
            if(lowerBranch.kind!=='series'){lowerBranch={kind:'series',id:id(),children:[lowerBranch]};targetGroup.branches[lowerIndex]=lowerBranch;}
            lowerBranch.rightBreak=true;
            setJunctionCell(lowerBranch,'rightBreak',upper-startRow,span,false);
          }
          return {project:next,selectedId:owner.node.id,cursor:destination};
        }
        if(cursor.column===(group.x-GRID_X)/COLUMN_WIDTH)return {project,selectedId:owner.node.id,cursor:destination,changed:false};
        throw new Error('Extend the branch to the matching right boundary, then draw Up/Down to join it.');
      }
      if(cursor.column===(open!.x-GRID_X)/COLUMN_WIDTH){
        const branchId=id(),next=structuredClone(project);
        const parallel=listNodes(next.programs[0].networks.find(n=>n.id===networkId)!.root).find(l=>l.node.id===owner.parent!.id)!.node;
        if(parallel.kind!=='parallel')throw new Error('Select a wire branch.');
        parallel.branches.splice(owner.index+(direction==='down'?1:0),0,{kind:'series',id:branchId,children:[],openEnd:true});
        return {project:next,selectedId:branchId,cursor:{row:direction==='up'?cursor.row:cursor.row+1,column:cursor.column}};
      }
    }
    // A vertical segment creates an open-ended row; it never creates a return leg.
    if(!source)throw new Error('Select a cell inside the current rung.');
    let materialized=materializeCell(project,networkId,source,id);
    if(source.kind==='blank' && !source.nodeId){
      const next=structuredClone(materialized.project),location=listNodes(next.programs[0].networks.find(n=>n.id===networkId)!.root).find(l=>l.node.id===materialized.selectedId)!;
      if(location.parent){childNodes(location.parent)![location.index]={kind:'series',id:location.node.id,children:[],openEnd:true};materialized={project:next,selectedId:location.node.id};}
    }
    const containerId=id(),branchId=id();
    const wrapped=editStructured(materialized.project,networkId,{kind:'wrap',nodeId:materialized.selectedId,group:'parallel',containerId,branchId});
    const next=structuredClone(wrapped.project),parallel=listNodes(next.programs[0].networks.find(n=>n.id===networkId)!.root).find(l=>l.node.id===containerId)!.node;
    if(parallel.kind!=='parallel')throw new Error('Select a wire branch.');
    const branch=parallel.branches[1];if(branch.kind==='series')branch.openEnd=true;
    if(direction==='up')parallel.branches.reverse();
    return {project:next,selectedId:branchId,cursor:{row:direction==='up'?cursor.row:cursor.row+1,column:cursor.column}};
  }
  // A wire leaving a closed branch's return leg is an external draft. Appending
  // inside its body would stretch the parallel group and move its coil/return.
  if (direction === 'right') {
    const target = layout.cells.find(c => c.row === cursor.row && c.column === cursor.column);
    if (!target?.nodeId && !target?.connected) {
      for (const group of layout.nodes.filter(p => p.node.kind === 'parallel').sort((a,b)=>a.width-b.width)) {
        if (group.node.kind !== 'parallel') continue;
        const end = (group.x+group.width-GRID_X)/COLUMN_WIDTH;
        const branch = group.node.branches.find(n => {
          const placed=layout.nodes.find(p=>p.node.id===n.id);
          return placed && (placed.y-GRID_Y)/ROW_HEIGHT===cursor.row;
        });
        if (!branch || branch.kind==='series' && branch.openEnd) continue;
        const length=branch.kind==='series' ? branch.rightExtension??0 : 0;
        if (cursor.column!==end+length) continue;
        const next=structuredClone(project);
        const parallel=listNodes(next.programs[0].networks.find(n=>n.id===networkId)!.root).find(l=>l.node.id===group.node.id)!.node;
        if (parallel.kind!=='parallel') throw new Error('Select a branch return.');
        const index=group.node.branches.findIndex(n=>n.id===branch.id);
        let row=parallel.branches[index];
        if(row.kind!=='series'){row={kind:'series',id:id(),children:[row]};parallel.branches[index]=row;}
        if(!row.children.length) row.children=Array.from({length:group.width/COLUMN_WIDTH},()=>({kind:'wire',id:id(),connected:false,erased:true}));
        const nodeId=id();row.children.push({kind:'wire',id:nodeId,connected:true});row.rightExtension=length+1;
        return {project:next,selectedId:nodeId,cursor:destination};
      }
    }
  }
  // On an open row, Right draws the segment starting at the cursor, not the next cell.
  const openRow = layout.nodes.filter(p => p.node.kind === 'series' && p.node.openEnd && (p.y-GRID_Y)/ROW_HEIGHT === cursor.row).at(-1);
  if (openRow && openRow.node.kind === 'series') {
    const column = direction === 'right' ? cursor.column : destination.column;
    const start = (openRow.x-GRID_X)/COLUMN_WIDTH + (openRow.node.wireOffset ?? 0);
    if (column < start) {
      const next = structuredClone(project);
      const branch = listNodes(next.programs[0].networks.find(n => n.id === networkId)!.root).find(l => l.node.id === openRow.node.id)!.node;
      if (branch.kind !== 'series') throw new Error('Select an open wire row.');
      const wires = Array.from({length: start-column}, (_, i) => ({kind:'wire' as const,id:id(),connected:i===0,...(i===0?{}:{erased:true})}));
      branch.children.unshift(...wires);
      branch.wireOffset = (branch.wireOffset ?? 0) - wires.length;
      return {project:next,selectedId:wires[0].id,cursor:destination};
    }
    let cell = layout.cells.find(c => c.row === cursor.row && c.column === column);
    if (!cell && column === layout.columns) cell = {row:cursor.row,column,kind:'blank',slot:{parentId:openRow.node.id,index:openRow.node.children.length,offset:0,count:1,connected:false}};
    if (!cell) throw new Error('Select a cell inside the current rung.');
    const at = materializeCell(project,networkId,cell,id), node = listNodes(at.project.programs[0].networks.find(n=>n.id===networkId)!.root).find(l=>l.node.id===at.selectedId)!.node;
    if (node.kind !== 'wire') throw new Error('Wire editing does not overwrite symbols.');
    const result = editStructured(at.project,networkId,{kind:'update',nodeId:node.id,node:{...node,connected:!node.connected,erased:node.connected}});
    return {...result,cursor:destination};
  }
  // The traversed horizontal interval is identical in either direction.
  // Right edits the source column; Left edits the destination column.
  const target = {row:cursor.row,column:Math.min(cursor.column,destination.column)};
  let cell = layout.cells.find(c => c.row === target.row && c.column === target.column);
  if (!cell && target.column === layout.columns) {
    const source = layout.cells.find(c=>c.row===cursor.row && c.column===Math.min(cursor.column,layout.columns-1));
    if(source?.nodeId) cell={...target,kind:'blank',slot:{anchorId:source.nodeId,side:'after',count:1,offset:0,connected:false}};
    else if(root.kind==='series' && target.row===0) cell={...target,kind:'blank',slot:{parentId:root.id,index:root.children.length,count:1,offset:0,connected:false}};
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
  const result = editStructured(materialized.project, networkId, { kind: 'update', nodeId: node.id, node: { ...node, connected: !node.connected, erased: node.connected } });
  return { ...result, cursor: destination };
}
