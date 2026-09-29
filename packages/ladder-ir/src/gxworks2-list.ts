import type { LadderProjectV02 } from "./v02.js";
import { compileProject } from "./fx3u-compiler.js";

const q=(v:string)=>`"${v.replace(/"/g,'""')}"`;
export function generateGxWorks2ListText(project:LadderProjectV02){
 const rows:string[][]=[
  [`(${project.name})`],
  ["PLC Information:","FXCPU FX3U/FX3UC"],
  ["Step No.","Line Statement","Instruction","I/O(Device)","Blank","PI Statement","Note"],
 ];
 let step=0;
 for(const x of compileProject(project)){
   rows.push([String(step++),"",x.instruction,x.device??"","","",""]);
 }
 rows.push([String(step),"","END","","","",""]);
 return rows.map(r=>r.map(q).join("\t")).join("\r\n")+"\r\n";
}
