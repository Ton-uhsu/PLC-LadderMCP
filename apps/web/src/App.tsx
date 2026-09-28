import { useState } from "react";
import {
  Activity, Bot, Braces, CheckCircle2, ChevronDown, CircleDot,
  Download, FileCode2, FolderOpen, Network, Play, Plus, Settings2,
  ShieldCheck, Workflow
} from "lucide-react";

type Vendor = "GX Works2" | "SamSoar2022";

function LadderPreview() {
  return (
    <svg viewBox="0 0 900 270" className="ladder" role="img" aria-label="M0 normally open contact drives M1 coil">
      <line x1="70" y1="35" x2="70" y2="235" className="wire rail" />
      <line x1="830" y1="35" x2="830" y2="235" className="wire rail" />
      <text x="28" y="95" className="step">0</text>
      <line x1="70" y1="90" x2="270" y2="90" className="wire" />
      <line x1="270" y1="66" x2="270" y2="114" className="symbol" />
      <line x1="310" y1="66" x2="310" y2="114" className="symbol" />
      <line x1="310" y1="90" x2="708" y2="90" className="wire" />
      <text x="290" y="54" textAnchor="middle" className="device">M0</text>
      <path d="M708 90 C708 58 755 58 755 90 C755 122 708 122 708 90" className="symbol fill-none" />
      <line x1="755" y1="90" x2="830" y2="90" className="wire" />
      <text x="732" y="54" textAnchor="middle" className="device">M1</text>
      <text x="28" y="188" className="step">2</text>
      <line x1="70" y1="183" x2="685" y2="183" className="wire muted-wire" />
      <text x="705" y="189" className="end">END</text>
      <line x1="755" y1="183" x2="830" y2="183" className="wire muted-wire" />
    </svg>
  );
}

export default function App() {
  const [vendor, setVendor] = useState<Vendor>("SamSoar2022");
  const [active, setActive] = useState("Ladder");

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><Workflow size={19}/></div><div><strong>PLC Ladder</strong><span>MCP Studio</span></div></div>
        <button className="new-project"><Plus size={17}/> New project</button>
        <nav>
          {[
            ["Ladder", Network], ["IR / JSON", Braces], ["Validation", ShieldCheck],
            ["AI Changes", Bot], ["Exports", Download]
          ].map(([label, Icon]) => {
            const I = Icon as typeof Network;
            return <button key={label as string} onClick={() => setActive(label as string)} className={active === label ? "nav-active" : ""}><I size={17}/>{label as string}</button>
          })}
        </nav>
        <div className="sidebar-bottom"><button><Settings2 size={17}/> Project settings</button><div className="engine"><span className="status-dot"/><div><b>Engine ready</b><small>IR schema v0.1</small></div></div></div>
      </aside>

      <main>
        <header>
          <div><div className="eyebrow">PROJECT / MAIN</div><h1>Untitled PLC Project</h1></div>
          <div className="header-actions"><button className="ghost"><FolderOpen size={16}/> Import</button><button className="primary"><Play size={15}/> Validate</button></div>
        </header>

        <section className="status-strip">
          <div><span>PLC FAMILY</span><b>Mitsubishi FX3U</b></div>
          <div><span>PROGRAM</span><b>Main</b></div>
          <div><span>NETWORKS</span><b>1</b></div>
          <div className="valid"><span>STATUS</span><b><CheckCircle2 size={15}/> Valid</b></div>
        </section>

        <div className="workspace">
          <section className="panel ladder-panel">
            <div className="panel-head"><div><span className="kicker">NETWORK 0</span><h2>Main Ladder</h2></div><div className="badge"><Activity size={14}/> LIVE IR PREVIEW</div></div>
            <div className="canvas"><LadderPreview /></div>
            <div className="network-note"><CircleDot size={14}/><span><b>Network 0</b> — Normally-open <code>M0</code> drives output coil <code>M1</code>.</span></div>
          </section>

          <aside className="right-column">
            <section className="panel export-card">
              <div className="panel-head compact"><div><span className="kicker">VENDOR OUTPUT</span><h2>Export</h2></div><FileCode2 size={20}/></div>
              <label>Target IDE</label>
              <div className="select-wrap"><select value={vendor} onChange={e => setVendor(e.target.value as Vendor)}><option>SamSoar2022</option><option>GX Works2</option></select><ChevronDown size={15}/></div>
              <div className="format-info"><span>FORMAT</span><b>{vendor === "GX Works2" ? "List CSV · UTF-16 LE" : "CSV · UTF-8 BOM"}</b></div>
              <button className="export-button"><Download size={16}/> Generate {vendor} file</button>
              <p>Generated from canonical Ladder IR. Vendor files are never the source of truth.</p>
            </section>

            <section className="panel checks">
              <span className="kicker">VALIDATION</span><h2>Project checks</h2>
              {["IR schema valid", "Topology valid", "Device syntax valid"].map(x => <div className="check" key={x}><CheckCircle2 size={16}/><span>{x}</span></div>)}
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}
