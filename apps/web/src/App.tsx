import { useMemo, useState } from "react";
import { Activity, Bot, Braces, CheckCircle2, ChevronDown, CircleDot, Download, FileCode2, FolderOpen, Network, Play, Plus, Settings2, ShieldCheck, Workflow } from "lucide-react";
import { downloadBytes, downloadText, generateGxWorks2, generateGxWorks2NextVerificationSuite, generateSamSoar, validateProject } from "./ladder";
import { useProjectStore } from "./store";

type Vendor = "GX Works2" | "SamSoar2022";

function LadderPreview() {
  const project = useProjectStore(s => s.project);
  const network = project.programs[0].networks[0];
  const contact = network.elements.find(e => e.type === "contact");
  const coils = network.elements.filter(e => e.type === "coil");
  const ys = coils.map((_,i)=>70+i*34);
  const top = ys[0] ?? 90, bottom = ys.at(-1) ?? 90;
  const height = Math.max(270, bottom + 120);
  return <svg viewBox={`0 0 900 ${height}`} className="ladder" role="img" aria-label="Ladder preview">
    <line x1="70" y1="35" x2="70" y2={height-35} className="wire rail"/>
    <line x1="830" y1="35" x2="830" y2={height-35} className="wire rail"/>
    <text x="28" y={top+5} className="step">{network.id}</text>
    <line x1="70" y1={top} x2="270" y2={top} className="wire"/>
    <line x1="270" y1={top-24} x2="270" y2={top+24} className="symbol"/>
    <line x1="310" y1={top-24} x2="310" y2={top+24} className="symbol"/>
    {contact?.type === "contact" && contact.mode === "NC" && <line x1="267" y1={top+25} x2="313" y2={top-25} className="symbol"/>}
    <text x="290" y={top-36} textAnchor="middle" className="device">{contact?.device}</text>
    <line x1="310" y1={top} x2="650" y2={top} className="wire"/>
    {coils.length > 1 && <line x1="650" y1={top} x2="650" y2={bottom} className="wire"/>}
    {coils.map((coil,i)=>{
      const y=ys[i];
      return <g key={coil.id}>
        <line x1="650" y1={y} x2="708" y2={y} className="wire"/>
        <path d={`M708 ${y} C708 ${y-22} 755 ${y-22} 755 ${y} C755 ${y+22} 708 ${y+22} 708 ${y}`} className="symbol fill-none"/>
        <line x1="755" y1={y} x2="830" y2={y} className="wire"/>
        <text x="732" y={y-28} textAnchor="middle" className="device">{coil.device}</text>
      </g>
    })}
    <text x="28" y={bottom+75} className="step">END</text>
    <line x1="70" y1={bottom+70} x2="685" y2={bottom+70} className="wire muted-wire"/>
    <text x="705" y={bottom+76} className="end">END</text>
    <line x1="755" y1={bottom+70} x2="830" y2={bottom+70} className="wire muted-wire"/>
  </svg>;
}
export default function App() {
  const project = useProjectStore(s => s.project);
  const apiUrl = useProjectStore(s => s.apiUrl);
  const connected = useProjectStore(s => s.connected);
  const setApiUrl = useProjectStore(s => s.setApiUrl);
  const syncProject = useProjectStore(s => s.syncProject);
  const [serverInput,setServerInput]=useState(apiUrl);
  const [vendor,setVendor]=useState<Vendor>("SamSoar2022");
  const [active,setActive]=useState("Ladder");
  const result=useMemo(()=>validateProject(project),[project]);
  const network=project.programs[0].networks[0];
  const contact=network.elements.find(e=>e.type==="contact");
  const coil=network.elements.find(e=>e.type==="coil");

  const exportFile=()=>{
    if(vendor==="SamSoar2022") downloadText("plc-ladder-samsoar.csv",generateSamSoar(project));
    else downloadBytes("plc-ladder-gxworks2.csv", generateGxWorks2(project));
  };

  const exportNextSuite=()=>downloadBytes("fx3u-next-verification.csv",generateGxWorks2NextVerificationSuite());

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Workflow size={19}/></div><div><strong>PLC Ladder</strong><span>MCP Studio</span></div></div>
      <button className="new-project"><Plus size={17}/> New project</button>
      <nav>{[["Ladder",Network],["IR / JSON",Braces],["Validation",ShieldCheck],["AI Changes",Bot],["Exports",Download]].map(([label,Icon])=>{const I=Icon as typeof Network;return <button key={label as string} onClick={()=>setActive(label as string)} className={active===label?"nav-active":""}><I size={17}/>{label as string}</button>})}</nav>
      <div className="sidebar-bottom"><button><Settings2 size={17}/> Project settings</button><div className="engine"><span className="status-dot"/><div><b>Engine ready</b><small>IR schema v0.1 + GX branch export</small></div></div></div>
    </aside>
    <main>
      <header><div><div className="eyebrow">PROJECT / {project.programs[0].name.toUpperCase()}</div><h1>{project.name}</h1></div><div className="header-actions"><button className="ghost"><FolderOpen size={16}/> Import</button><button className="primary" onClick={()=>alert(result.valid?"Project is valid.":result.issues.join("\n"))}><Play size={15}/> Validate</button></div></header>
      <section className="status-strip"><div><span>PLC FAMILY</span><b>{project.plc.family} {project.plc.model}</b></div><div><span>PROGRAM</span><b>{project.programs[0].name}</b></div><div><span>NETWORKS</span><b>{project.programs[0].networks.length}</b></div><div className="valid"><span>STATUS</span><b><CheckCircle2 size={15}/>{result.valid?"Valid":"Invalid"}</b></div></section>
      <div className="server-bar">
        <input value={serverInput} onChange={e=>setServerInput(e.target.value)} placeholder="https://xxxxx.trycloudflare.com" />
        <button onClick={async()=>{setApiUrl(serverInput); setTimeout(async()=>{try{await useProjectStore.getState().syncProject()}catch(e){alert("Server connection failed: "+String(e))}},0)}}>Connect server</button>
        <button className="ghost" onClick={()=>syncProject().catch(e=>alert(String(e)))}>Sync now</button>
        <span className={connected?"server-online":"server-offline"}>{connected?"SERVER CONNECTED":"LOCAL / DEMO"}</span>
      </div>
      <div className="workspace">
        <section className="panel ladder-panel">
          <div className="panel-head"><div><span className="kicker">{active==="IR / JSON"?"CANONICAL SOURCE":`NETWORK ${network.id}`}</span><h2>{active==="IR / JSON"?"Ladder IR / JSON":"Main Ladder"}</h2></div><div className="badge"><Activity size={14}/> LIVE IR PREVIEW</div></div>
          {active==="IR / JSON"?<pre className="json-view">{JSON.stringify(project,null,2)}</pre>:<div className="canvas"><LadderPreview/></div>}
          <div className="network-note"><CircleDot size={14}/><span><b>Network {network.id}</b> — {contact?.type==="contact"?(contact.mode==="NO"?"Normally-open":"Normally-closed"):"Contact"} <code>{contact?.device}</code> drives output coil <code>{coil?.device}</code>.</span></div>
        </section>
        <aside className="right-column">
          <section className="panel export-card"><div className="panel-head compact"><div><span className="kicker">VENDOR OUTPUT</span><h2>Export</h2></div><FileCode2 size={20}/></div><label>Target IDE</label><div className="select-wrap"><select value={vendor} onChange={e=>setVendor(e.target.value as Vendor)}><option>SamSoar2022</option><option>GX Works2</option></select><ChevronDown size={15}/></div><div className="format-info"><span>FORMAT</span><b>{vendor==="GX Works2"?"List CSV · pending serializer fix":"CSV · UTF-8 BOM"}</b></div><button className="export-button" onClick={exportFile} disabled={!result.valid}><Download size={16}/> Generate {vendor} file</button><button className="ghost" onClick={exportNextSuite}><Download size={15}/> Next FX3U test file</button><p>Generated directly from the canonical Ladder IR shown in this app.</p></section>
          <section className="panel checks"><span className="kicker">VALIDATION</span><h2>Project checks</h2>{result.valid?["IR schema valid","Topology valid","Device syntax valid"].map(x=><div className="check" key={x}><CheckCircle2 size={16}/><span>{x}</span></div>):result.issues.map(x=><div className="check" key={x}><span>{x}</span></div>)}</section>
        </aside>
      </div>
    </main>
  </div>;
}
