import { compileNetwork, type ListInstruction } from './fx3u-compiler.js';
import { validateFx3uV02, type ValidationIssue } from './fx3u-validator.js';
import { childNodes } from './structured-edit.js';
import type { LadderProjectV02, LogicNode } from './v02.js';
export const COMPILE_VERSION = 'fx3u-v02-4';
export type CompileDiagnostic = Omit<ValidationIssue,'severity'> & {severity:'error'|'warning'|'info';networkId?:number;nodeId?:string};
export type CompileReport = {status:'PASS'|'FAIL';diagnostics:CompileDiagnostic[];instructions:ListInstruction[];compilerVersion:string};
export function locateDiagnostic(project:LadderProjectV02,path:string) {
  const match=path.match(/^programs\[(\d+)\]\.networks\[(\d+)\]\.root(.*)$/);
  if(!match)return {};
  const network=project.programs[Number(match[1])]?.networks[Number(match[2])];
  if(!network)return {};
  let node:LogicNode=network.root;
  for(const part of match[3].matchAll(/\.(children|branches)\[(\d+)\]/g)){const next=childNodes(node)?.[Number(part[2])];if(!next)break;node=next;}
  return {networkId:network.id,nodeId:node.id};
}
export function compileWithDiagnostics(project:LadderProjectV02):CompileReport {
  const diagnostics:CompileDiagnostic[]=validateFx3uV02(project).issues.map(i=>({...i,...locateDiagnostic(project,i.path)}));
  const instructions:ListInstruction[]=[];
  if(!project.programs.length || !project.programs.some(p=>p.networks.length)) diagnostics.push({severity:'error',code:'EMPTY_PROJECT',message:'Add a program and network before compiling.',path:'programs'});
  project.programs.forEach((program,pi)=>program.networks.forEach((network,ni)=>{
    const path=`programs[${pi}].networks[${ni}].root`;
    function check(node:LogicNode,at:string){
      if(node.kind==='contact' && node.mode==='NC' && node.edge && node.edge!=='none') diagnostics.push({severity:'error',code:'UNSUPPORTED_NC_EDGE',message:'NC edge contacts are not supported by this compiler.',path:at,networkId:network.id,nodeId:node.id});
      childNodes(node)?.forEach((n,i)=>check(n,`${at}.${node.kind==='series'?'children':'branches'}[${i}]`));
    }
    check(network.root,path);
    try {instructions.push(...compileNetwork(network));}catch(e){
      if(!diagnostics.some(d=>d.networkId===network.id && d.severity==='error'))diagnostics.push({severity:'error',code:'COMPILE_TOPOLOGY',message:e instanceof Error?e.message:String(e),path,networkId:network.id,nodeId:network.root.id});
    }
  }));
  const status=diagnostics.some(d=>d.severity==='error')?'FAIL':'PASS';
  return {status,diagnostics,instructions:status==='PASS'?instructions:[],compilerVersion:COMPILE_VERSION};
}
