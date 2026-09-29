import type { LadderProjectV02, LogicNode } from "./v02.js";
import { inspectFx3uInstructionForm } from "./fx3u-capabilities.js";

export type ValidationIssue={severity:"error"|"warning";code:string;message:string;path:string};
const bit=/^(X|Y|M|S)\d+$/i;
const word=/^(D|T|C)\d+$/i;

function walk(node:LogicNode,path:string,issues:ValidationIssue[]){
 if(node.kind==="contact"){
   if(!bit.test(node.device.address)) issues.push({severity:"error",code:"FX3U_CONTACT_DEVICE",message:`Contact device ${node.device.address} is not in the currently validated bit-device subset X/Y/M/S.`,path});
   return;
 }
 if(node.kind==="series"){ if(!node.children.length)issues.push({severity:"error",code:"EMPTY_SERIES",message:"Series node cannot be empty.",path}); node.children.forEach((n,i)=>walk(n,`${path}.children[${i}]`,issues)); return; }
 if(node.kind==="parallel"){ if(node.branches.length<2)issues.push({severity:"warning",code:"REDUNDANT_PARALLEL",message:"Parallel node should normally contain at least two branches.",path}); node.branches.forEach((n,i)=>walk(n,`${path}.branches[${i}]`,issues)); return; }
 const a=node.action;
 if(["coil","set","reset"].includes(a.kind)){
   const d=(a as any).device.address as string;
   if(!bit.test(d))issues.push({severity:"error",code:"FX3U_OUTPUT_DEVICE",message:`${a.kind} target ${d} is outside the currently validated bit-device subset X/Y/M/S.`,path});
 } else if(a.kind==="instruction"){
   if(!a.opcode.trim())issues.push({severity:"error",code:"EMPTY_OPCODE",message:"Instruction opcode is required.",path});
   a.operands.forEach((o,i)=>{if(o.kind==="device"&&!bit.test(o.address)&&!word.test(o.address))issues.push({severity:"warning",code:"DEVICE_RULE_PENDING",message:`Device ${o.address} requires opcode-specific FX3U validation.`,path:`${path}.operands[${i}]`})});
   const capability=inspectFx3uInstructionForm(a.opcode,a.operands);
   if(capability.status==="rejected") issues.push({severity:"error",code:"FX3U_REJECTED_FORM",message:`${capability.opcode} ${capability.operands.join(" ")} is a known rejected GX Works2 form. ${capability.evidence}`,path});
   else if(capability.status==="unverified") issues.push({severity:"warning",code:"FX3U_FORM_UNVERIFIED",message:`${capability.opcode} ${capability.operands.join(" ")} has no exact real-GX verification record yet.`,path});
   else if(capability.status==="partial") issues.push({severity:"warning",code:"FX3U_FORM_PARTIAL",message:`${capability.opcode} ${capability.operands.join(" ")} has partial GX verification evidence only.`,path});
 }
}

export function validateFx3uV02(project:LadderProjectV02){
 const issues:ValidationIssue[]=[];
 if(project.plc.model!=="FX3U")issues.push({severity:"error",code:"TARGET_MODEL",message:"This profile currently targets FX3U.",path:"plc.model"});
 project.programs.forEach((p,pi)=>p.networks.forEach((n,ni)=>walk(n.root,`programs[${pi}].networks[${ni}].root`,issues)));
 return {valid:!issues.some(i=>i.severity==="error"),issues};
}
