import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, GitBranch, MousePointer2, Plus, Redo2, Trash2, Undo2, ZoomIn, ZoomOut } from 'lucide-react';
import { childNodes, editNetwork, editStructured, listNodes, type LadderProjectV02, type StructuredEdit } from '@plc-ladder-mcp/ladder-ir';
import { useProjectStore } from '../store';
import { Inspector } from '../persistence/ManualEditor';
import { LadderRenderer } from './LadderRenderer';
import { layoutLadder, nodeLabel } from './layout';
import { insertElement, toolElement, type EditorTool } from './commands';
const tools: { tool: EditorTool; glyph: string; label: string; input: string }[] = [
  { tool: 'contact', glyph: '─| |─', label: 'NO contact', input: 'X0' }, { tool: 'nc', glyph: '─|/|─', label: 'NC contact', input: 'X0' },
  { tool: 'coil', glyph: '─( )─', label: 'Output coil', input: 'Y0' }, { tool: 'set', glyph: '(S)', label: 'SET', input: 'Y0' }, { tool: 'reset', glyph: '(R)', label: 'RST', input: 'Y0' },
  { tool: 'timer', glyph: 'T', label: 'Timer', input: 'T0 K10' }, { tool: 'counter', glyph: 'C', label: 'Counter', input: 'C0 K10' }, { tool: 'instruction', glyph: '[…]', label: 'Instruction', input: 'MOV K0 D0' },
];
type Result = { project: LadderProjectV02; selectedId: string };
export function EditorWorkspace() {
  const state = useProjectStore();
  const { project, projectId, selectedNetworkId, selectNetwork, connected, switching, storageMode, editProject, history, undoProject, redoProject } = state;
  const networks = project.programs[0]?.networks ?? [];
  const network = networks.find(n => n.id === selectedNetworkId) ?? networks[0];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [entry, setEntry] = useState<EditorTool | null>(null), [input, setInput] = useState('');
  const [position, setPosition] = useState<'before' | 'after'>('after');
  const [stageWidth, setStageWidth] = useState(980);
  const [zoom, setZoom] = useState(100), [comment, setComment] = useState(network?.comment ?? '');
  const stage = useRef<HTMLDivElement>(null), properties = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!stage.current) return; const observer = new ResizeObserver(entries => setStageWidth(entries[0].contentRect.width)); observer.observe(stage.current); return () => observer.disconnect(); }, []);
  const sheetWidth = Math.max(700, stageWidth, ...networks.map(n => layoutLadder(n.root).width + 56));
  const nodes = network ? listNodes(network.root) : [];
  const selection = nodes.find(n => n.node.id === selectedId) ?? nodes[0];
  const disabled = busy || switching || !connected || !network || storageMode === 'database' && !projectId;
  useEffect(() => { setSelectedId(null); setEntry(null); setError(''); }, [projectId]);
  useEffect(() => { setSelectedId(value => network && listNodes(network.root).some(n => n.node.id === value) ? value : null); setEntry(null); setError(''); }, [selectedNetworkId]);
  useEffect(() => { setComment(network?.comment ?? ''); }, [network?.id, network?.comment, projectId]);
  useEffect(() => { if (entry) { inputRef.current?.focus(); inputRef.current?.select(); } }, [entry]);
  async function perform(make: (project: LadderProjectV02, networkId: number) => Result, report = true) {
    if (disabled) throw new Error('Connect a current backend and select a project before editing.');
    setBusy(true); setError(''); const context = useProjectStore.getState();
    try {
      const result = make(context.project, context.selectedNetworkId);
      await editProject(result.project);
      const current = useProjectStore.getState();
      if (current.apiUrl !== context.apiUrl || current.apiToken !== context.apiToken || current.projectId !== context.projectId || current.selectedNetworkId !== context.selectedNetworkId) throw new Error("Workspace changed before this edit finished. Select the current project again.");
      setSelectedId(result.selectedId);
    } catch (e) { if (report) setError(e instanceof Error ? e.message : String(e)); throw e; }
    finally { setBusy(false); }
  }
  function mutate(edit: StructuredEdit) { void perform((p, n) => editStructured(p, n, edit)).catch(() => undefined); }
  function networkEdit(kind: 'add' | 'delete' | 'move', direction?: -1 | 1) {
    void perform(p => {
      const result = editNetwork(p, kind === 'add' ? { kind, rootId: crypto.randomUUID() } : kind === 'move' ? { kind, networkId: selectedNetworkId, direction: direction! } : { kind, networkId: selectedNetworkId });
      return { project: result.project, selectedId: result.project.programs[0].networks.find(n => n.id === result.selectedId)!.root.id };
    }).then(() => {
      const current = useProjectStore.getState().project.programs[0].networks;
      if (kind === 'add') selectNetwork(current.at(-1)!.id);
      if (kind === 'delete' && !current.some(n => n.id === selectedNetworkId)) selectNetwork(current[0].id);
    }).catch(() => undefined);
  }
  function openTool(tool: EditorTool) { if (disabled) return; setEntry(tool); setInput(tools.find(t => t.tool === tool)!.input); setError(''); }
  function remove() { if (selection?.parent && !disabled) mutate({ kind: 'remove', nodeId: selection.node.id }); }
  function focusProperties() { requestAnimationFrame(() => properties.current?.querySelector<HTMLInputElement>('input')?.focus()); }
  const currentIndex = networks.findIndex(n => n.id === network?.id);
  return <section className="ladder-editor-workspace" aria-label="Ladder editor" onKeyDown={e => {
    const target = e.target as HTMLElement;
    if (target.closest('input,select,textarea,[contenteditable="true"]')) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (!disabled) void (e.shiftKey ? redoProject() : undoProject()).catch(err => setError(String(err))); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); if (!disabled) void redoProject().catch(err => setError(String(err))); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Delete') { e.preventDefault(); remove(); }
    if (e.key === 'Escape') { setEntry(null); setSelectedId(null); }
    if (e.key === 'Enter') { e.preventDefault(); focusProperties(); }
    if (e.key.toLowerCase() === 'c') { e.preventDefault(); openTool('contact'); }
    if (e.key.toLowerCase() === 'o') { e.preventDefault(); openTool('coil'); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault(); const leaves = nodes.filter(n => !childNodes(n.node)?.length); const i = leaves.findIndex(n => n.node.id === selection?.node.id);
      const next = leaves[Math.max(0, Math.min(leaves.length - 1, i + (e.key === 'ArrowRight' ? 1 : -1)))]; if (next) setSelectedId(next.node.id);
    }
  }}>
    <div className="editor-toolbars">
      <div className="editor-toolbar" role="toolbar" aria-label="Ladder tools">
        <button title="Select (Esc)" aria-label="Select tool" onClick={() => setEntry(null)} className={!entry ? 'tool active' : 'tool'}><MousePointer2 size={16}/></button>
        <span className="tool-divider"/>
        {tools.map(t => <button key={t.tool} className={entry === t.tool ? 'tool symbol-tool active' : 'tool symbol-tool'} disabled={disabled} aria-label={`Insert ${t.label}`} title={`${t.label}${t.tool === 'contact' ? ' (C)' : t.tool === 'coil' ? ' (O)' : ''}`} onClick={() => openTool(t.tool)}><b>{t.glyph}</b><small>{t.label}</small></button>)}
        <span className="tool-divider"/>
        <button className="tool" disabled={disabled || !selection?.parent} title="Add parallel branch around selection" aria-label="Add parallel branch" onClick={() => { if (!selection) return; if (selection.node.kind === 'action' || selection.node.kind === 'parallel' && selection.node.branches.every(n => n.kind === 'action')) openTool('coil'); else mutate({ kind: 'wrap', nodeId: selection.node.id, group: 'parallel', containerId: crypto.randomUUID(), branchId: crypto.randomUUID() }); }}><GitBranch size={17}/><small>Branch</small></button>
        <button className="tool" disabled={disabled || !selection?.parent} title="Delete selected element" aria-label="Delete element" onClick={remove}><Trash2 size={16}/></button>
        <button className="tool" disabled={disabled || !history.can_undo} title="Undo (Ctrl+Z)" aria-label="Undo edit" onClick={() => void undoProject().catch(e => setError(String(e)))}><Undo2 size={17}/></button>
        <button className="tool" disabled={disabled || !history.can_redo} title="Redo (Ctrl+Shift+Z)" aria-label="Redo edit" onClick={() => void redoProject().catch(e => setError(String(e)))}><Redo2 size={17}/></button>
        <span className="tool-divider"/>
        <button className="tool" disabled={zoom <= 60} title="Zoom out" aria-label="Zoom out" onClick={() => setZoom(Math.max(60, zoom - 10))}><ZoomOut size={16}/></button>
        <span className="zoom-label">{zoom}%</span>
        <button className="tool" disabled={zoom >= 150} title="Zoom in" aria-label="Zoom in" onClick={() => setZoom(Math.min(150, zoom + 10))}><ZoomIn size={16}/></button>
      </div>
      <div className="editor-program-strip"><span className="program-tab">Main</span><span>{project.plc.model}</span><span className="editor-save-state" role="status">{busy ? 'Saving…' : !connected ? 'Disconnected' : storageMode === 'database' ? `r${state.revision ?? '—'} · ${state.saveStatus}` : 'Local workspace'}</span><button disabled={disabled} onClick={() => networkEdit('add')}><Plus size={13}/> Network</button><button disabled={disabled || currentIndex <= 0} title="Move network up" aria-label="Move network up" onClick={() => networkEdit('move', -1)}><ArrowUp size={13}/></button><button disabled={disabled || currentIndex === networks.length - 1} title="Move network down" aria-label="Move network down" onClick={() => networkEdit('move', 1)}><ArrowDown size={13}/></button><button disabled={disabled || networks.length <= 1} title="Delete network" aria-label="Delete network" onClick={() => { if (confirm('Delete the selected network? Undo can restore it.')) networkEdit('delete'); }}><Trash2 size={13}/></button></div>
      {entry && <form className="editor-command-entry" onSubmit={e => {
        e.preventDefault();
        void perform((p, n) => insertElement(p, n, selectedId, toolElement(entry, input, () => crypto.randomUUID()), position, () => crypto.randomUUID())).then(() => { setEntry(null); stage.current?.focus(); }).catch(() => undefined);
      }}><strong>Insert {tools.find(t => t.tool === entry)?.label}</strong><input ref={inputRef} aria-label="Element address or instruction" value={input} onChange={e => setInput(e.target.value)} disabled={disabled}/><label>Contact position<select value={position} onChange={e => setPosition(e.target.value as 'before' | 'after')}><option value="before">Before selected</option><option value="after">After selected</option></select></label><button disabled={disabled}>Insert ↵</button><button type="button" onClick={() => setEntry(null)}>Cancel</button></form>}
      {(error || state.saveError) && <div className="editor-error" role="alert">{error || state.saveError}<button onClick={() => { if (state.saveError) void state.saveProject().catch(e => setError(String(e))); else setError(''); }}>{state.saveError ? 'Retry save' : 'Dismiss'}</button></div>}
    </div>
    <div className="editor-split">
      <div className="editor-stage" ref={stage} tabIndex={0} aria-label="Ladder canvas">
        <div className="editor-sheet" style={{ zoom: zoom / 100, width: sheetWidth }}>
          <div className="editor-ruler"><span>Network</span>{Array.from({ length: 7 }, (_, n) => <span key={n}>{n}</span>)}</div>
          {!networks.length && <div className="editor-empty">Create or load a project to begin editing.</div>}
          {networks.map((rung, index) => <article key={rung.id} className={rung.id === network?.id ? 'editor-rung selected-rung' : 'editor-rung'}>
            <button className="rung-gutter" aria-label={`Select network ${index + 1}`} aria-pressed={rung.id === network?.id} onClick={() => { selectNetwork(rung.id); setSelectedId(rung.root.id); }}><strong>{index + 1}</strong><small>N{rung.id}</small></button>
            <div className="rung-body"><button className="rung-comment" onClick={() => { selectNetwork(rung.id); setSelectedId(rung.root.id); }}>{rung.comment || `Network ${index + 1}`}</button>
              <LadderRenderer root={rung.root} theme="dark" minWidth={sheetWidth - 56} selectedId={rung.id === network?.id ? selectedId : null} onSelect={id => { if (rung.id !== selectedNetworkId) { selectNetwork(rung.id); } setSelectedId(id); }} onEdit={id => { selectNetwork(rung.id); setSelectedId(id); focusProperties(); }}/>
            </div>
          </article>)}
          <div className="editor-end"><span>END</span></div>
        </div>
      </div>
      <aside className="editor-properties" ref={properties} aria-label="Element properties">
        <div className="properties-title">Properties<span>{network ? `Network ${currentIndex + 1}` : ''}</span></div>
        {selection && <>
          <h3>{nodeLabel(selection.node)}</h3>
          <Inspector key={`${network?.id}:${selection.node.id}`} node={selection.node} disabled={disabled} onUpdate={node => perform((p, n) => editStructured(p, n, { kind: 'update', nodeId: node.id, node }), false)}/>
          <div className="property-order"><button disabled={disabled || !selection.parent || selection.index === 0} title="Move element earlier" aria-label="Move element earlier" onClick={() => mutate({ kind: 'move', nodeId: selection.node.id, direction: -1 })}><ArrowLeft size={14}/></button><button disabled={disabled || !selection.parent || selection.index === childNodes(selection.parent)!.length - 1} title="Move element later" aria-label="Move element later" onClick={() => mutate({ kind: 'move', nodeId: selection.node.id, direction: 1 })}><ArrowRight size={14}/></button><span>Execution order</span></div>
          <label className="rung-label">Network label<input aria-label="Network label" value={comment} disabled={disabled} onChange={e => setComment(e.target.value)} onBlur={() => { if (comment !== (network?.comment ?? '')) void perform(p => { const result = editNetwork(p, { kind: 'comment', networkId: selectedNetworkId, comment }); return { project: result.project, selectedId: selection.node.id }; }).catch(() => undefined); }}/></label>
          <details className="structure-details"><summary>Rung structure</summary>{nodes.map(l => <button key={l.node.id} onClick={() => setSelectedId(l.node.id)} style={{ paddingLeft: 8 + l.depth * 12 }} className={l.node.id === selection.node.id ? 'chosen' : ''}>{nodeLabel(l.node)}</button>)}</details>
        </>}
        {!selection && <p>Select a rung or symbol.</p>}
      </aside>
    </div>
    <div className="editor-statusbar"><span>{network ? `Main / Network ${currentIndex + 1}` : 'Main'}</span><span>{selection ? nodeLabel(selection.node) : 'Select a symbol'}</span><span>C contact · O coil · Delete remove · Ctrl+Z undo</span><span>Draft · not compiled</span></div>
  </section>;
}
