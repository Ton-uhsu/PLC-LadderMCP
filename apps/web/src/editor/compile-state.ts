import { create } from 'zustand';
import { COMPILE_VERSION, type CompileReport, type LadderProjectV02 } from '@plc-ladder-mcp/ladder-ir';
import { useProjectStore } from '../store';
export type WorkspaceCompile = CompileReport & {id:string;projectId?:string;revision?:string;startedAt:string;snapshot?:LadderProjectV02;contextKey:string;inputKey:string};
export function compileContext(s:ReturnType<typeof useProjectStore.getState>){return `${s.apiUrl}:${s.storageMode}:${s.projectId??`local:${s.project.name}`}:${s.apiToken}`;}
export function compileInput(s:ReturnType<typeof useProjectStore.getState>){return JSON.stringify({revision:s.revision,project:s.project});}
export const useCompileState=create<{run:WorkspaceCompile|null;runs:WorkspaceCompile[];busy:boolean;error:string;compile:()=>Promise<void>;focus:{networkId:number;nodeId?:string;nonce:number}|null;locate:(networkId:number,nodeId?:string)=>void}>(set=>({
  run:null,runs:[],busy:false,error:'',focus:null,
  locate:(networkId,nodeId)=>{useProjectStore.getState().selectNetwork(networkId);set({focus:{networkId,nodeId,nonce:Date.now()}});},
  compile:async()=>{
    if(useCompileState.getState().busy)return;
    const s=useProjectStore.getState();
    if(!s.connected||s.switching){set({error:'Connect a backend and select a project before compiling.'});return;}
    if(s.storageMode==='database'&&(s.dirty||s.saveStatus!=='saved'||!s.revision||!s.projectId)){set({error:'Save the current draft before Compile.'});return;}
    const contextKey=compileContext(s),inputKey=compileInput(s);
    set({busy:true,error:''});
    try{
      const path=s.storageMode==='database'?`/api/persistence/projects/${s.projectId}/compile`:'/api/manual/compile';
      const body=s.storageMode==='database'?{revision:s.revision,requestId:crypto.randomUUID()}:{snapshot:s.project};
      const response=await fetch(s.apiUrl+path,{method:'POST',headers:{authorization:`Bearer ${s.apiToken}`,'content-type':'application/json'},body:JSON.stringify(body)});
      const data=await response.json();if(!response.ok)throw new Error(data.error??`Compile HTTP ${response.status}`);
      const current=useProjectStore.getState();if(compileContext(current)!==contextKey)return;
      const run:WorkspaceCompile={...data,contextKey,inputKey};
      set(state=>({run,runs:[run,...state.runs.filter(r=>r.contextKey===contextKey)].slice(0,50)}));
    }catch(e){if(compileContext(useProjectStore.getState())===contextKey)set({error:e instanceof Error?e.message:String(e)});}
    finally{set({busy:false});}
  },
}));
export function currentCompile(s:ReturnType<typeof useProjectStore.getState>,run:WorkspaceCompile|null){return !!run && run.compilerVersion===COMPILE_VERSION && run.contextKey===compileContext(s)&&run.inputKey===compileInput(s)&&!s.dirty&&!s.switching;}
