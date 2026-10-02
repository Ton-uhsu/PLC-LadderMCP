import { useCompileState, currentCompile } from './editor/compile-state';
import { listNodes, parseGxWorks2ListText } from "@plc-ladder-mcp/ladder-ir";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, AlertTriangle, Bot, Braces, CheckCircle2, ChevronDown, CircleDot, Download,
  FileCode2, FolderOpen, History as HistoryIcon, Network, Play, Plus, Redo2, RefreshCw, Settings2, ShieldCheck, Undo2, Workflow, XCircle,
} from "lucide-react";
import {
  downloadBytes,
  downloadText,
  validateProject,
} from "./ladder";
import { ProjectSettings } from "./projects/ProjectSettings";
import { LadderRenderer } from "./editor/LadderRenderer";
import { EditorWorkspace } from "./editor/EditorWorkspace";
import { SessionControls } from './auth/SessionControls';
import { useProjectStore } from "./store";

type Vendor = "GX Works2" | "SamSoar2022";

function LadderPreview({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string) => void }) {
  const project = useProjectStore(s => s.project);
  const selectedNetworkId = useProjectStore(s => s.selectedNetworkId);
  const network = project.programs[0]?.networks.find(n => n.id === selectedNetworkId);
  return network ? <LadderRenderer root={network.root} selectedId={listNodes(network.root).some(l => l.node.id === selectedId) ? selectedId : network.root.id} onSelect={onSelect}/> : <div className="json-view">No Ladder network in the current IR.</div>;
}

function formatDiffValue(value: unknown) {
  if (value === null) return "∅";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value, null, 2);
}

function AIChangesPanel() {
  const connected = useProjectStore(s => s.connected);
  const pendingChanges = useProjectStore(s => s.pendingChanges);
  const loadingChanges = useProjectStore(s => s.loadingChanges);
  const syncPendingChanges = useProjectStore(s => s.syncPendingChanges);
  const approvePendingChange = useProjectStore(s => s.approvePendingChange);
  const rejectPendingChange = useProjectStore(s => s.rejectPendingChange);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!connected) return;
    syncPendingChanges().catch(() => undefined);
    const timer = window.setInterval(() => {
      syncPendingChanges().catch(() => undefined);
    }, 2000);
    return () => window.clearInterval(timer);
  }, [connected, syncPendingChanges]);

  if (!connected) {
    return <div className="changes-empty">
      <Bot size={26}/>
      <strong>Connect to the MCP server to review AI changes.</strong>
      <span>AI writes appear here as proposals. The MCP client cannot approve or apply them directly.</span>
    </div>;
  }

  return <div className="changes-list">
    <div className="changes-toolbar">
      <div>
        <b>{pendingChanges.length} pending change{pendingChanges.length === 1 ? "" : "s"}</b>
        <span>AI proposals stay unapplied until you approve them here. The list refreshes automatically.</span>
      </div>
      <button className="ghost" onClick={() => syncPendingChanges().catch(error => alert(String(error)))}>
        <RefreshCw size={14} className={loadingChanges ? "spin" : ""}/> Refresh
      </button>
    </div>

    {!loadingChanges && pendingChanges.length === 0 && <div className="changes-empty compact">
      <CheckCircle2 size={24}/>
      <strong>No pending AI changes</strong>
      <span>When the AI calls a write tool, its proposal and diff will appear here automatically.</span>
    </div>}

    {pendingChanges.map(change => <article className={"change-card " + (change.stale ? "stale" : "")} key={change.id}>
      <div className="change-card-head">
        <div>
          <div className="change-operation">{change.operation.replaceAll("_", " ")}</div>
          <h3>{change.summary}</h3>
          <small>{new Date(change.created_at).toLocaleString()}</small>
        </div>
        <div className={"change-status " + (change.validation.valid && !change.stale ? "ready" : "warning")}>
          {change.stale || !change.validation.valid ? <AlertTriangle size={14}/> : <CheckCircle2 size={14}/>}
          {change.stale ? "STALE" : change.validation.valid ? "VALID" : "INVALID"}
        </div>
      </div>

      <div className="change-diff">
        {change.changes.map((diff, index) => <div className="diff-row" key={diff.path + "-" + index}>
          <code className="diff-path">{diff.path}</code>
          <div className="diff-values">
            <div><span>BEFORE</span><pre>{formatDiffValue(diff.before)}</pre></div>
            <div><span>AFTER</span><pre>{formatDiffValue(diff.after)}</pre></div>
          </div>
        </div>)}
      </div>

      {!change.validation.valid && <div className="change-issues">
        {change.validation.issues.filter(issue => issue.severity === "error").map((issue, index) =>
          <div key={issue.code + "-" + index}><AlertTriangle size={13}/><span>{issue.message}</span></div>
        )}
      </div>}

      <div className="change-actions">
        <button
          className="reject-button"
          disabled={busyId === change.id}
          onClick={async () => {
            setBusyId(change.id);
            try { await rejectPendingChange(change.id); }
            catch (error) { alert(String(error)); }
            finally { setBusyId(null); }
          }}
        ><XCircle size={15}/> Reject</button>
        <button
          className="approve-button"
          disabled={busyId === change.id || change.stale || !change.validation.valid}
          title={change.stale ? "Project changed after this proposal. Preview it again." : !change.validation.valid ? "Resulting project is invalid." : "Apply this change"}
          onClick={async () => {
            setBusyId(change.id);
            try { await approvePendingChange(change.id); }
            catch (error) { alert(String(error)); }
            finally { setBusyId(null); }
          }}
        ><CheckCircle2 size={15}/> Approve</button>
      </div>
    </article>)}
  </div>;
}


function HistoryPanel() {
  const database = useProjectStore(s => s.storageMode === "database");
  const connected = useProjectStore(s => s.connected);
  const history = useProjectStore(s => s.history);
  const loadingHistory = useProjectStore(s => s.loadingHistory);
  const syncHistory = useProjectStore(s => s.syncHistory);
  const undoProject = useProjectStore(s => s.undoProject);
  const redoProject = useProjectStore(s => s.redoProject);
  const [busy, setBusy] = useState<"undo" | "redo" | null>(null);

  useEffect(() => {
    if (connected) syncHistory().catch(() => undefined);
  }, [connected, syncHistory]);

  if (!connected) {
    return <div className="changes-empty">
      <HistoryIcon size={26}/>
      <strong>Connect to the MCP server to view project history.</strong>
      <span>Applied semantic changes, approvals, undo, and redo actions are recorded here.</span>
    </div>;
  }

  return <div className="history-panel">
    <div className="history-toolbar">
      <div>
        <b>{database ? "Local session undo / redo" : "Project history"}</b>
        <span>{history.undo_count} undo step{history.undo_count === 1 ? "" : "s"} · {history.redo_count} redo step{history.redo_count === 1 ? "" : "s"}</span>
      </div>
      <div className="history-actions">
        <button
          className="ghost"
          disabled={!history.can_undo || busy !== null}
          onClick={async () => {
            setBusy("undo");
            try { await undoProject(); }
            catch (error) { alert(String(error)); }
            finally { setBusy(null); }
          }}
        ><Undo2 size={14}/> Undo</button>
        <button
          className="ghost"
          disabled={!history.can_redo || busy !== null}
          onClick={async () => {
            setBusy("redo");
            try { await redoProject(); }
            catch (error) { alert(String(error)); }
            finally { setBusy(null); }
          }}
        ><Redo2 size={14}/> Redo</button>
        <button className="ghost" onClick={() => syncHistory().catch(error => alert(String(error)))}>
          <RefreshCw size={14} className={loadingHistory ? "spin" : ""}/> Refresh
        </button>
      </div>
    </div>

    {!loadingHistory && history.entries.length === 0 && <div className="changes-empty compact">
      <HistoryIcon size={24}/>
      <strong>{database ? "Immutable revisions are saved in PostgreSQL" : "No history yet"}</strong>
      <span>{database ? "Undo / redo tracks edits in this session. A historical revision browser is not available yet." : "Create or edit Ladder logic and the applied changes will appear here."}</span>
    </div>}

    <div className="history-list">
      {history.entries.map(entry => <div className={"history-entry " + entry.kind} key={entry.id}>
        <div className="history-icon">
          {entry.kind === "undo" ? <Undo2 size={14}/> : entry.kind === "redo" ? <Redo2 size={14}/> : <CheckCircle2 size={14}/>}
        </div>
        <div className="history-copy">
          <div className="history-meta">
            <span>{entry.kind.toUpperCase()}</span>
            <span>{entry.source === "approved" ? "AI APPROVED" : entry.source.toUpperCase()}</span>
          </div>
          <b>{entry.summary}</b>
          <small>{entry.operation.replaceAll("_", " ")} · {new Date(entry.created_at).toLocaleString()}</small>
        </div>
      </div>)}
    </div>
  </div>;
}


export default function App() {
  const workspace = useProjectStore();
  const compileState = useCompileState();
  const exportEligible = currentCompile(workspace,compileState.run) && compileState.run?.status === "PASS";
  const [exportError,setExportError] = useState("");
  const storageMode = useProjectStore(s => s.storageMode);
  const defaultExportTarget = useProjectStore(s => s.defaultExportTarget);
  const projectId = useProjectStore(s => s.projectId);
  const revision = useProjectStore(s => s.revision);
  const saveStatus = useProjectStore(s => s.saveStatus);
  const saveError = useProjectStore(s => s.saveError);
  const dirty = useProjectStore(s => s.dirty);
  const switching = useProjectStore(s => s.switching);
  const reloadLatest = useProjectStore(s => s.reloadLatest);

  const project = useProjectStore(s => s.project);
  const selectedNetworkId = useProjectStore(s => s.selectedNetworkId);
  const selectNetwork = useProjectStore(s => s.selectNetwork);
  const apiUrl = useProjectStore(s => s.apiUrl);
  const apiToken = useProjectStore(s => s.apiToken);
  const connected = useProjectStore(s => s.connected);
  const setApiUrl = useProjectStore(s => s.setApiUrl);
  const setApiToken = useProjectStore(s => s.setApiToken);
  const syncProject = useProjectStore(s => s.syncProject);
  const savedProjects = useProjectStore(s => s.savedProjects);
  const syncSavedProjects = useProjectStore(s => s.syncSavedProjects);
  const saveProject = useProjectStore(s => s.saveProject);
  const loadProject = useProjectStore(s => s.loadProject);
  const importGxWorks2 = useProjectStore(s => s.importGxWorks2);
  const setProject = useProjectStore(s => s.setProject);
  const createProject = useProjectStore(s => s.createProject);
  const [serverInput, setServerInput] = useState(apiUrl);
  const [tokenInput, setTokenInput] = useState(apiToken);
  const [vendor, setVendor] = useState<Vendor>("SamSoar2022");
  const [active, setActive] = useState("Ladder");
  const [showTools, setShowTools] = useState(false);
  const [showConnection, setShowConnection] = useState(false);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  useEffect(() => { setSelectedElementId(null); }, [projectId, selectedNetworkId]);
  const [saveName, setSaveName] = useState(project.name);
  const [savedSelection, setSavedSelection] = useState("");
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSavedSelection(projectId ?? "");
  }, [projectId]);
  useEffect(() => {
    setVendor(defaultExportTarget === "gxworks2" ? "GX Works2" : "SamSoar2022");
  }, [projectId, defaultExportTarget]);

  useEffect(() => {
    setSaveName(project.name);
  }, [project.name]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const result = useMemo(() => validateProject(project), [project]);
  const program = project.programs[0];
  const network = program?.networks.find(item => item.id === selectedNetworkId) ?? program?.networks[0];
  const elements = network ? listNodes(network.root) : [];
  const contactCount = elements.filter(l => l.node.kind === 'contact').length;
  const actionCount = elements.filter(l => l.node.kind === 'action').length;

  const [exporting,setExporting] = useState(false);
  const [ideVersion,setIdeVersion] = useState('');
  const exportFile = async () => {
    setExportError('');
    if(!exportEligible || !compileState.run){setExportError('Compile the current saved draft successfully before exporting.');return;}
    if(storageMode==='database' && !ideVersion.trim()){setExportError('Enter the target IDE version to record this export.');return;}
    const context=workspace;
    setExporting(true);
    try {
      const target=vendor==='GX Works2'?'gxworks2':'samsoar2022';
      const path=storageMode==='database'?`/api/persistence/projects/${projectId}/export`:'/api/manual/export';
      const body=storageMode==='database'?{revision,compileId:compileState.run.id,target,ideVersion:ideVersion.trim(),requestId:crypto.randomUUID()}:{compileId:compileState.run.id,target};
      const response=await fetch(apiUrl+path,{method:'POST',headers:{authorization:`Bearer ${apiToken}`,'content-type':'application/json'},body:JSON.stringify(body)});
      const data=await response.json();if(!response.ok || data.status!=='SUCCESS' || !data.artifact)throw new Error(data.error??`Export HTTP ${response.status}`);
      const current=useProjectStore.getState();
      if(current.apiUrl!==context.apiUrl||current.apiToken!==context.apiToken||current.projectId!==context.projectId||current.project!==context.project)throw new Error('Workspace changed during export. The retained artifact belongs to the earlier revision; export the current revision again.');
      downloadBytes(data.artifact.filename,Uint8Array.from(atob(data.artifact.base64),c=>c.charCodeAt(0)),data.artifact.mediaType);
    } catch(e){setExportError(e instanceof Error?e.message:String(e));}
    finally{setExporting(false);}
  };

  return <div className={active === "Ladder" ? "app-shell editor-mode" : "app-shell"}>
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark"><Workflow size={19}/></div>
        <div><strong>PLC Ladder</strong><span>MCP Studio</span></div>
      </div>
      <button className="new-project" disabled={switching} onClick={() => {
        const name = prompt("Project name", "Untitled PLC Project");
        if (name !== null) createProject(name).catch(error => alert(String(error)));
      }}><Plus size={17}/> New project</button>
      {active === "Ladder" && <details className="project-tree" open><summary>Project · {project.plc.model}</summary><button className="tree-program" onClick={()=>setActive("Ladder")}>Program ▸ {program?.name ?? "MAIN"}</button></details>}
      <nav>
        {[["Ladder", Network], ["IR / JSON", Braces], ["Validation", ShieldCheck], ["AI Changes", Bot], ["History", HistoryIcon], ["Exports", Download]].map(([label, Icon]) => {
          const I = Icon as typeof Network;
          return <button key={label as string} onClick={() => setActive(label as string)} className={active === label ? "nav-active" : ""}>
            <I size={17}/>{label as string}
          </button>;
        })}
      </nav>
      <div className="sidebar-bottom">
        <button className={active === "Project settings" ? "nav-active" : ""} onClick={() => setActive("Project settings")}><Settings2 size={17}/> Project settings</button>
        <div className="engine">
          <span className="status-dot"/>
          <div><b>Engine ready</b><small>IR schema v0.2 · shared FX3U compiler</small></div>
        </div>
        <SessionControls/>
      </div>
    </aside>

    <main>
      <header>
        <div>
          <div className="eyebrow">PROJECT / {(program?.name ?? "MAIN").toUpperCase()}</div>
          <h1>{project.name}</h1>
        </div>
        <div className="header-actions">
          <button className="ghost" onClick={() => setShowConnection(!showConnection)}>Connection</button>
          <button className="ghost" onClick={() => setShowTools(!showTools)}>Project / Export</button>
          <input
            ref={importRef}
            type="file"
            accept=".csv,.txt,.tsv"
            hidden
            onChange={async event => {
              const file = event.target.files?.[0];
              if (!file) return;
              try {
                const bytes = new Uint8Array(await file.arrayBuffer());
                const utf16 = bytes[0] === 0xff && bytes[1] === 0xfe;
                const text = utf16
                  ? new TextDecoder("utf-16le").decode(bytes.slice(2))
                  : new TextDecoder("utf-8").decode(bytes);
                if (connected) await importGxWorks2(text);
                else setProject(parseGxWorks2ListText(text));
                setActive("Ladder");
              } catch (error) {
                alert("GX Works2 import failed: " + String(error));
              } finally {
                event.target.value = "";
              }
            }}
          />
          <button className="ghost" disabled={switching || (storageMode === "database" && !projectId)} onClick={() => importRef.current?.click()}><FolderOpen size={16}/> Import GX Works2</button>
          <button className="primary" onClick={() => void compileState.compile()} disabled={compileState.busy || dirty}>
            <Play size={15}/> Compile
          </button>
        </div>
      </header>

      <section className="status-strip">
        <div><span>PLC FAMILY</span><b>{project.plc.family} {project.plc.model}</b></div>
        <div><span>PROGRAM</span><b>{program?.name ?? "—"}</b></div>
        <div><span>NETWORKS</span><b>{program?.networks.length ?? 0}</b></div>
        <div className="valid"><span>STATUS</span><b><CheckCircle2 size={15}/>{currentCompile(workspace,compileState.run) ? `Compile ${compileState.run!.status}` : "Compile Required"}</b></div>
      </section>

      <div className="server-bar" hidden={active === "Ladder" && !showConnection}>
        <input value={serverInput} onChange={e => setServerInput(e.target.value)} placeholder="http://localhost:3001 or Cloudflare URL"/>
        <input className="token-input" type="password" value={tokenInput} onChange={e => setTokenInput(e.target.value)} placeholder="Bearer token (optional locally)"/>
        <button disabled={dirty || switching} onClick={() => {
          setApiUrl(serverInput);
          setApiToken(tokenInput);
          setTimeout(async () => {
            try {
              await useProjectStore.getState().syncProject();
              await useProjectStore.getState().syncSavedProjects();
            } catch (error) { alert("Server connection failed: " + String(error)); }
          }, 0);
        }}>Connect server</button>
        <button className="ghost" disabled={switching} onClick={() => syncProject().catch(error => alert(String(error)))}>Sync now</button>
        <span className={connected ? "server-online" : "server-offline"}>{connected ? "SERVER CONNECTED" : "LOCAL / DEMO"}</span>
      </div>

      <div className={active === "Ladder" ? `workspace editor-container ${showTools ? "with-tools" : ""}` : "workspace"}>
        <section className="panel ladder-panel">
          <div className="panel-head" hidden={active === "Ladder"}>
            <div>
              <span className="kicker">{active === "IR / JSON" ? "CANONICAL SOURCE" : active === "AI Changes" ? "HUMAN REVIEW" : active === "History" ? "CHANGE LOG" : `NETWORK ${network?.id ?? "—"}`}</span>
              <h2>{active === "IR / JSON" ? "Ladder IR v0.2 / JSON" : active === "AI Changes" ? "AI Changes" : active === "History" ? "History / Undo / Redo" : active === "Project settings" ? "Project settings" : "Main Ladder"}</h2>
            </div>
            <div className="badge"><Activity size={14}/> LIVE IR PREVIEW</div>
          </div>

          {(active === "IR / JSON" || active === "Validation") && <div className="network-tabs">
            {program?.networks.map((item, position) => {
              const networkValid = validateProject({
                ...project,
                programs: [{ ...program, networks: [item] }],
              }).valid;
              return <button
                key={item.id}
                disabled={switching}
                className={item.id === network?.id ? "network-tab active" : "network-tab"}
                onClick={() => selectNetwork(item.id)}
              >
                <div className="network-tab-title">
                  <b>{position + 1}. Network {item.id}</b>
                  <i className={networkValid ? "network-state valid" : "network-state invalid"}>{networkValid ? "VALID" : "INVALID"}</i>
                </div>
                <span>{item.comment || "No comment"}</span>
              </button>;
            })}
          </div>}

          {active === "Ladder" ? <EditorWorkspace/> : active === "Project settings"
            ? <ProjectSettings/>
            : active === "IR / JSON"
            ? <pre className="json-view">{JSON.stringify(project, null, 2)}</pre>
            : active === "AI Changes"
              ? <>{storageMode === "database" ? <div className="changes-empty">AI review for this saved project will be available after batch persistence integration.</div> : <AIChangesPanel/>}</>
              : active === "History"
                ? <HistoryPanel/>
                : <div className="canvas"><LadderPreview selectedId={selectedElementId} onSelect={setSelectedElementId}/></div>}


          {active !== "Ladder" && active !== "AI Changes" && active !== "History" && active !== "Project settings" && <div className="network-note">
            <CircleDot size={14}/>
            <span><b>Network {network?.id ?? "—"}</b> · {contactCount} contacts · {actionCount} actions. Select a Ladder element to inspect or edit it.</span>
          </div>}
        </section>

        <aside className="right-column" hidden={active === "Ladder" && !showTools}>
          <section className="panel export-card">
            <div className="panel-head compact">
              <div><span className="kicker">VENDOR OUTPUT</span><h2>Export</h2></div>
              <FileCode2 size={20}/>
            </div>
            <label>Target IDE · export override</label>
            <div className="select-wrap">
              <select value={vendor} onChange={e => setVendor(e.target.value as Vendor)}>
                <option>SamSoar2022</option>
                <option>GX Works2</option>
              </select>
              <ChevronDown size={15}/>
            </div>
            <div className="format-info">
              <span>FORMAT</span>
              <b>{vendor === "GX Works2" ? "List CSV · UTF-16 LE BOM" : "CSV · UTF-8 BOM"}</b>
            </div>
            {storageMode==='database' && <><label htmlFor="export-ide-version">Target IDE version</label><input id="export-ide-version" value={ideVersion} onChange={e=>setIdeVersion(e.target.value)} placeholder="Version installed on your PC"/></>}
            {vendor==='SamSoar2022' && <p>Intermediate CSV only. Native SamSoar project import is not verified. Series contacts and coil outputs only.</p>}
            <button className="export-button" onClick={() => void exportFile()} disabled={!exportEligible || exporting}>
              <Download size={16}/> Generate {vendor} file
            </button>
            <p>{storageMode === "database" ? "Export retains exact bytes and Compile evidence for the saved revision." : "Export requires a passing Compile of this exact snapshot."}</p>
          {exportError && <p role="alert">{exportError}</p>}
          </section>

          <section className="panel project-files">
            <div className="panel-head compact"><div><span className="kicker">PERSISTENCE</span><h2>{storageMode === "database" ? "Saved projects" : "Project files"}</h2></div><FolderOpen size={19}/></div>
            <label>Save as</label>
            <input value={storageMode === "database" ? project.name : saveName} disabled={switching || (storageMode === "database" && !projectId)} onChange={e => {
              if (storageMode === "database") setProject({ ...project, name: e.target.value }); else setSaveName(e.target.value);
            }} placeholder="Project snapshot name"/>
            <button className="ghost project-file-button" disabled={!connected || switching || (storageMode === "database" && !projectId)} onClick={() => saveProject(storageMode === "database" ? undefined : saveName).catch(error => alert(String(error)))}>{storageMode === "database" ? "Save now / Retry" : "Save JSON snapshot"}</button>
            <label>Saved projects</label>
            <select disabled={switching} value={savedSelection} onChange={e => setSavedSelection(e.target.value)}>
              <option value="">Select saved project</option>
              {savedProjects.map(item => <option key={item.file} value={item.id ?? item.name}>{item.name} {item.revision_no ? `· r${item.revision_no}` : ""}</option>)}
            </select>
            <div className="project-file-actions">
              <button className="ghost" disabled={!connected} onClick={() => syncSavedProjects().catch(error => alert(String(error)))}>Refresh</button>
              <button className="ghost" disabled={!connected || !savedSelection || switching} onClick={() => loadProject(savedSelection).catch(error => alert(String(error)))}>Load</button>
            </div>
            {storageMode === "database" ? <div>
              <p role="status">{projectId ? `Revision ${revision} · ${saveStatus}` : "Create or select a saved project to start editing."}</p>
              {saveError && <p role="alert">{saveError}</p>}
              <button className="ghost" onClick={() => downloadText("ladder-draft.json", JSON.stringify(project, null, 2))}>Download draft JSON</button>
              {projectId && <button className="ghost" disabled={switching || saveStatus === "saving"} onClick={() => {
                if (!dirty || confirm("Discard this local draft and load the latest saved revision? Download the draft first to keep a copy.")) reloadLatest().catch(error => alert(String(error)));
              }}>Load latest revision</button>}
            </div> : <p>Legacy JSON workspace. PostgreSQL is not configured on this server.</p>}
          </section>

          <section className="panel checks">
            <span className="kicker">VALIDATION</span>
            <h2>Project checks</h2>
            {result.valid
              ? ["IR v0.2 valid", "Topology valid", "FX3U device syntax valid"].map(item =>
                  <div className="check" key={item}><CheckCircle2 size={16}/><span>{item}</span></div>)
              : result.issues.map(issue => <div className="check" key={issue}><span>{issue}</span></div>)}
          </section>
        </aside>
      </div>
      <div className="mobile-session-footer"><SessionControls/></div>
    </main>
  </div>;
}
