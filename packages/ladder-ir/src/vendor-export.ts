import { compileWithDiagnostics } from './compile-report.js';
import { containsAction } from './structured-edit.js';
import { normalizeWires, outputActions } from './fx3u-compiler.js';
import { generateGxWorks2ListText } from './gxworks2-list.js';
import type { LadderProjectV02, LogicNode } from './v02.js';
export type VendorTarget='gxworks2'|'samsoar2022';
export function vendorArtifact(project:LadderProjectV02,target:VendorTarget){
 const compiled=compileWithDiagnostics(project);if(compiled.status!=='PASS')throw new Error(compiled.diagnostics.filter(d=>d.severity==='error').map(d=>d.message).join('; '));
 if(target==='gxworks2'){
  const text=generateGxWorks2ListText(project),bytes=new Uint8Array(2+text.length*2);bytes[0]=255;bytes[1]=254;
  for(let i=0;i<text.length;i++){const c=text.charCodeAt(i);bytes[2+i*2]=c&255;bytes[3+i*2]=c>>8;}
  return {filename:'plc-ladder-gxworks2.csv',mediaType:'text/csv',encoding:'UTF-16LE',format:'list-csv',bytes};
 }
 const rows:string[]=[];
 const quote=(v:string)=>/[",\r\n]/.test(v)?`"${v.replace(/"/g,'""')}"`:v;
 for(const program of project.programs){rows.push(`Program,${quote(program.name)}`);for(const network of program.networks){
  rows.push(`Network,${network.id}`);const root=network.root;
  if(root.kind!=='series')throw new Error('SamSoar adapter requires a series root.');
  const index=root.children.findIndex(containsAction);
  const conditions=root.children.slice(0,index).map(normalizeWires).filter((n):n is LogicNode=>n!==null);
  if(conditions.some(n=>n.kind!=='contact'))throw new Error('SamSoar adapter supports series contacts only. Nested conditions require a native adapter.');
  if(!conditions.length)rows.push('LD,M8000');
  conditions.forEach((n,i)=>{if(n.kind!=='contact')return;if(n.edge && n.edge!=='none')throw new Error('SamSoar adapter cannot preserve edge contacts.');rows.push(`${i===0?n.mode==='NC'?'LDI':'LD':n.mode==='NC'?'ANI':'AND'},${n.device.address}`);});
  for(const action of outputActions({kind:'series',id:root.id,children:root.children.slice(index)})){if(action.kind!=='coil')throw new Error('SamSoar adapter supports coil outputs only.');rows.push(`OUT,${action.device.address}`);}
  rows.push('POP');
 }}
 return {filename:'plc-ladder-samsoar.csv',mediaType:'text/csv',encoding:'UTF-8',format:'intermediate-csv',bytes:new TextEncoder().encode('\uFEFF'+rows.join('\r\n')+'\r\n')};
}
