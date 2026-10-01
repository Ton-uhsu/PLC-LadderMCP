import {childNodes,containsAction,listNodes,type LadderProjectV02,type LogicNode} from '@plc-ladder-mcp/ladder-ir';
import {insertElement} from './commands';
import {materializeCell} from './grid-commands';
import type {GridCell} from './layout';
export type EntryMode='overwrite'|'insert';
export function enterAtCell(project:LadderProjectV02,networkId:number,cell:GridCell|undefined,selectedId:string|null,node:LogicNode,mode:EntryMode,position:'before'|'after',id:()=>string){
 const root=project.programs[0].networks.find(n=>n.id===networkId)?.root;if(!root)throw new Error('Select a network.');
 // First output is aligned by the renderer; do not create a disconnected placeholder ahead of it.
 if(node.kind==='action' && !containsAction(root))return insertElement(project,networkId,selectedId,node,position,id);
 const at=cell && !cell.nodeId ? materializeCell(project,networkId,cell,id) : {project,selectedId:cell?.nodeId??selectedId};
 if(mode==='insert' || !at.selectedId)return insertElement(at.project,networkId,at.selectedId,node,position,id);
 const next=structuredClone(at.project),network=next.programs[0].networks.find(n=>n.id===networkId)!;
 const target=listNodes(network.root).find(l=>l.node.id===at.selectedId);
 if(!target || childNodes(target.node))return insertElement(at.project,networkId,at.selectedId,node,position,id);
 const replacement=structuredClone(node);
 if(replacement.kind===target.node.kind){replacement.id=target.node.id;if(replacement.kind==='action' && target.node.kind==='action')replacement.action.id=target.node.action.id;}
 if(target.parent)childNodes(target.parent)![target.index]=replacement;else network.root=replacement;
 return {project:next,selectedId:replacement.id};
}
