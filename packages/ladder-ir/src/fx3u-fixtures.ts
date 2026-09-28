import type { LadderProjectV02, LogicNode, ActionNode } from "./v02";

const d=(address:string)=>({kind:"device" as const,address});
const contact=(id:string,address:string,mode:"NO"|"NC"="NO"):LogicNode=>({kind:"contact",id,device:d(address),mode});
const action=(a:ActionNode):LogicNode=>({kind:"action",id:"node-"+a.id,action:a});
const coil=(id:string,address:string)=>action({kind:"coil",id,device:d(address)});
const instr=(id:string,opcode:string,operands:any[])=>action({kind:"instruction",id,opcode,operands});
const project=(name:string,root:LogicNode):LadderProjectV02=>({version:"0.2",name,plc:{family:"Mitsubishi FX",model:"FX3U"},programs:[{name:"Main",networks:[{id:0,root}]}]});

export const fx3uVerificationFixtures={
  nc: project("FX3U NC", {kind:"series",id:"s",children:[contact("c","M0","NC"),coil("y","Y0")]}),
  series: project("FX3U Series", {kind:"series",id:"s",children:[contact("c0","M0"),contact("c1","M1"),coil("y","Y0")]}),
  set: project("FX3U SET", {kind:"series",id:"s",children:[contact("c","M0"),action({kind:"set",id:"set",device:d("Y0")})]}),
  reset: project("FX3U RST", {kind:"series",id:"s",children:[contact("c","M0"),action({kind:"reset",id:"rst",device:d("Y0")})]}),
  timer: project("FX3U Timer", {kind:"series",id:"s",children:[contact("c","M0"),instr("t","OUT",[d("T0"),{kind:"constant",radix:"decimal",value:10}])]}),
  counter: project("FX3U Counter", {kind:"series",id:"s",children:[contact("c","M0"),instr("cnt","OUT",[d("C0"),{kind:"constant",radix:"decimal",value:10}])]}),
  mov: project("FX3U MOV", {kind:"series",id:"s",children:[contact("c","M0"),instr("mov","MOV",[{kind:"constant",radix:"decimal",value:100},d("D0")])]}),
  add: project("FX3U ADD", {kind:"series",id:"s",children:[contact("c","M0"),instr("add","ADD",[d("D0"),d("D1"),d("D2")])]})
};
