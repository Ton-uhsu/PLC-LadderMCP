import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, GitBranch, MousePointer2, Plus, Search, Redo2, Trash2, Undo2, ZoomIn, ZoomOut } from 'lucide-react';
import { childNodes, editNetwork, editStructured, listNodes, type LadderProjectV02, type StructuredEdit } from '@plc-ladder-mcp/ladder-ir';
import { useProjectStore } from '../store';
import { useCompileState, currentCompile, compileContext, compileInput, type WorkspaceCompile } from './compile-state';
import { Inspector } from '../persistence/ManualEditor';
import { LadderRenderer } from './LadderRenderer';
import { COLUMN_WIDTH, GRID_X, layoutLadder, nodeLabel, type GridCell } from './layout';
import { captureSelection, pasteSelection, useEditorClipboard } from './clipboard';
import { clearCellRange, cellIsInRange, normalizeCellRange, rangeCellCount, type CellRange } from './cell-selection';
import { editGridWire, materializeCell, type CellCursor } from './grid-commands';
import { captureRange, cutRange, pasteRange, type RangeClip } from './range-clipboard';
import { type WireDirection } from './wire-commands';
import { enterAtCell, type EntryMode } from './cursor-input';
import { insertElement, toolElement, type EditorTool } from './commands';
const tools: { tool: EditorTool; glyph: string; label: string; input: string }[] = [
  { tool: 'contact', glyph: '─| |─', label: 'NO contact', input: 'X0' }, { tool: 'nc', glyph: '─|/|─', label: 'NC contact', input: 'X0' },
  { tool: 'coil', glyph: '─( )─', label: 'Output coil', input: 'Y0' }, { tool: 'set', glyph: '(S)', label: 'SET', input: 'Y0' }, { tool: 'reset', glyph: '(R)', label: 'RST', input: 'Y0' },
  { tool: 'timer', glyph: 'T', label: 'Timer', input: 'T0 K10' }, { tool: 'counter', glyph: 'C', label: 'Counter', input: 'C0 K10' }, { tool: 'instruction', glyph: '[…]', label: 'Instruction', input: 'MOV K0 D0' },
];
type Result = { project: LadderProjectV02; selectedId: string; networkId?: number; changed?: boolean };
type NetworkCellRange = CellRange & { networkId: number };
export function EditorWorkspace() {
  const state = useProjectStore();
  const compileState = useCompileState();
  const compiledCurrent = currentCompile(state, compileState.run);
  const compileStatus = compiledCurrent ? compileState.run!.status : "Required";
  const [dismissedCompile, setDismissedCompile] = useState<string | null>(null);
  const hasCompileResults = !!compileState.run && compileState.run.contextKey === compileContext(state);
  const showCompileResults = hasCompileResults && compileState.run!.id !== dismissedCompile;
  const [showProperties,setShowProperties] = useState(false);
  const [entryMode,setEntryMode] = useState<EntryMode>('overwrite');
  const clipboard = useEditorClipboard();
  const [rangeClip, setRangeClip] = useState<RangeClip | null>(null);
  const [editing, setEditing] = useState<{ networkId: number; nodeId: string } | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const busyRef = useRef(false);
  const [finding, setFinding] = useState(false), [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const { project, projectId, selectedNetworkId, selectNetwork, connected, switching, storageMode, editProject, history, undoProject, redoProject } = state;
  const networks = project.programs[0]?.networks ?? [];
  const network = networks.find(n => n.id === selectedNetworkId) ?? networks[0];
  const [cursor, setCursor] = useState<(CellCursor & { networkId: number }) | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cellSelection, setCellSelection] = useState<NetworkCellRange | null>(null);
  const selectingCells = useRef(false), selectionMoved = useRef(false), suppressSelectionClick = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [entry, setEntry] = useState<EditorTool | null>(null), [input, setInput] = useState('');
  const [position, setPosition] = useState<'before' | 'after'>('after');
  const [stageWidth, setStageWidth] = useState(980);
  const [zoom, setZoom] = useState(100), [comment, setComment] = useState(network?.comment ?? '');
  const stage = useRef<HTMLDivElement>(null), properties = useRef<HTMLElement>(null);
  function closeCompileResults() {
    setDismissedCompile(compileState.run?.id ?? null);
    useCompileState.setState({error:''});
    stage.current?.focus();
  }
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!stage.current) return; const observer = new ResizeObserver(entries => setStageWidth(entries[0].contentRect.width)); observer.observe(stage.current); return () => observer.disconnect(); }, []);
  const sheetWidth = Math.max(700, stageWidth, ...networks.map(n => layoutLadder(n.root).width + 56));
  const nodes = network ? listNodes(network.root) : [];
  const selection = nodes.find(n => n.node.id === selectedId) ?? nodes[0];
  useEffect(() => { const element = cursor ? stage.current?.querySelector(`.selected-rung [data-cell-row="${cursor.row}"][data-cell-column="${cursor.column}"]`) : selectedId ? stage.current?.querySelector(`[data-node-id="${CSS.escape(selectedId)}"]`) : null; element?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }, [selectedId, selectedNetworkId, cursor]);
  const grid = network ? layoutLadder(network.root) : null;
  const activeCursor = cursor?.networkId === network?.id ? cursor : null;
  const edge = grid?.cells.find(c => c.row === activeCursor?.row && c.column === grid.columns - 1);
  const cell: GridCell | undefined = activeCursor
    ? grid?.cells.find(c => c.row === activeCursor.row && c.column === activeCursor.column) ?? {
      row: activeCursor.row, column: activeCursor.column, kind: 'blank',
      ...(edge?.nodeId ? {slot:{anchorId:edge.nodeId,side:'after',offset:0,count:1,connected:false}} : {}),
    }
    : grid?.cells.find(c => c.nodeId === selection?.node.id);
  const selectedCellCount = cellSelection ? rangeCellCount(cellSelection) : 0;
  const multipleCells = selectedCellCount > 1;
  function updateCellFocus(rungId: number, cell: GridCell) {
    selectNetwork(rungId);
    setSelectedId(cell.nodeId ?? cell.slot?.anchorId ?? cell.slot?.parentId ?? null);
    setCursor({ networkId: rungId, row: cell.row, column: cell.column });
  }
  function selectCell(rungId: number, cell: GridCell, extend = false) {
    if (suppressSelectionClick.current) return;
    const point = { row: cell.row, column: cell.column };
    setCellSelection(current => ({
      networkId: rungId,
      anchor: extend && current?.networkId === rungId
        ? current.anchor
        : extend && cursor?.networkId === rungId ? cursor : point,
      focus: point,
    }));
    updateCellFocus(rungId, cell);
  }
  function beginCellSelection(rungId: number, cell: GridCell, extend: boolean) {
    selectingCells.current = true;
    selectionMoved.current = false;
    selectCell(rungId, cell, extend);
  }
  function extendCellSelection(rungId: number, cell: GridCell) {
    if (!selectingCells.current) return;
    setCellSelection(current => {
      if (!current || current.networkId !== rungId) return current;
      if (current.focus.row !== cell.row || current.focus.column !== cell.column) selectionMoved.current = true;
      return { ...current, focus: { row: cell.row, column: cell.column } };
    });
    updateCellFocus(rungId, cell);
  }
  function finishCellSelection() {
    selectingCells.current = false;
    if (!selectionMoved.current) return;
    suppressSelectionClick.current = true;
    window.setTimeout(() => { suppressSelectionClick.current = false; }, 0);
  }
  const disabled = busy || switching || !connected || !network || storageMode === 'database' && !projectId;
  useEffect(() => { setSelectedId(null); setCursor(null); setCellSelection(null); setEntry(null); setError(''); }, [projectId, project.name]);
  useEffect(() => {
    if(storageMode!=='database' || !projectId || !state.connected || state.dirty)return;
    const contextKey=compileContext(state),inputKey=compileInput(state);let cancelled=false;
    void fetch(`${state.apiUrl}/api/persistence/projects/${projectId}/compile`,{headers:{authorization:`Bearer ${state.apiToken}`}}).then(async response=>{
      if(!response.ok)throw new Error(`Compile history HTTP ${response.status}`);
      const reports=await response.json();if(cancelled || compileContext(useProjectStore.getState())!==contextKey)return;
      const runs=reports.map((r:WorkspaceCompile)=>({...r,contextKey,inputKey:r.revision===state.revision ? inputKey : `historical:${r.revision}`}));
      const local=useCompileState.getState().runs.filter(r=>r.contextKey===contextKey);
      const combined=[...local,...runs].filter((r,i,all)=>all.findIndex(x=>x.id===r.id)===i).sort((a,b)=>b.startedAt.localeCompare(a.startedAt));
      useCompileState.setState({runs:combined,run:combined[0]??null});
    }).catch(()=>undefined);
    return()=>{cancelled=true;};
  },[projectId,storageMode,state.apiUrl,state.apiToken,state.revision,state.dirty]);
  useEffect(() => { setSelectedId(value => network && listNodes(network.root).some(n => n.node.id === value) ? value : null); setCellSelection(value => value?.networkId === selectedNetworkId ? value : null); setEntry(null); setError(''); }, [selectedNetworkId]);
  useEffect(() => { setComment(network?.comment ?? ''); }, [network?.id, network?.comment, projectId]);
  useEffect(() => { if (entry) { inputRef.current?.focus(); inputRef.current?.select(); } }, [entry]);
  async function perform<T extends Result>(make: (project: LadderProjectV02, networkId: number) => T, report = true) {
    if (disabled || busyRef.current) throw new Error('Connect a current backend and select a project before editing.');
    busyRef.current = true; setBusy(true); setError(''); const context = useProjectStore.getState();
    try {
      const result = make(context.project, context.selectedNetworkId);
      if (result.changed === false) { setCursor(null); setSelectedId(result.selectedId); return result; }
      await editProject(result.project);
      const current = useProjectStore.getState();
      if (current.apiUrl !== context.apiUrl || current.apiToken !== context.apiToken || current.projectId !== context.projectId || current.selectedNetworkId !== context.selectedNetworkId) throw new Error("Workspace changed before this edit finished. Select the current project again.");
      if (result.networkId !== undefined) selectNetwork(result.networkId);
      setCursor(null); setSelectedId(result.selectedId);
      return result;
    } catch (e) { if (report) setError(e instanceof Error ? e.message : String(e)); throw e; }
    finally { busyRef.current = false; setBusy(false); }
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
  function openTool(tool: EditorTool, initial?:string) { if (disabled || multipleCells) return; setEntry(tool); setInput(initial ?? tools.find(t => t.tool === tool)!.input); setError(''); }
  function remove() {
    if (disabled) return;
    if (cellSelection || cursor && cell) {
      const range = cellSelection ?? { networkId: cursor!.networkId, anchor: cell!, focus: cell! };
      void perform(p => clearCellRange(p, range.networkId, range, () => crypto.randomUUID())).then(result => {setCellSelection(null);const root=result.project.programs[0].networks.find(n=>n.id===range.networkId)!.root;const at=layoutLadder(root).cells.find(c=>c.row===range.focus.row && c.column===range.focus.column);if(at)updateCellFocus(range.networkId,at);stage.current?.focus();}).catch(() => undefined);
      return;
    }
    if (cell && !cell.nodeId) {
      if (cell.kind === 'wire') void perform((p, n) => { const at = materializeCell(p, n, cell, () => crypto.randomUUID()); return editStructured(at.project, n, {kind:'update',nodeId:at.selectedId,node:{kind:'wire',id:at.selectedId,connected:false,erased:true}}); }).catch(() => undefined);
      return;
    }
    if (selection?.parent) mutate({ kind: 'remove', nodeId: selection.node.id });
  }
  function focusProperties() { setShowProperties(true); requestAnimationFrame(() => properties.current?.querySelector<HTMLInputElement>('input')?.focus()); }
  const origin = `${state.apiUrl}:${storageMode}:${projectId ?? project.programs[0]?.networks[0]?.root.id}`;
  function copy(cut = false) {
    if (!selection || !network || disabled) return;
    if (multipleCells && cellSelection) {
      try {
        if (cut) void perform(p => cutRange(p, network.id, cellSelection, origin, () => crypto.randomUUID())).then(result => { setRangeClip(result.clip); setCellSelection(null); }).catch(() => undefined);
        else setRangeClip(captureRange(project, network.id, cellSelection, origin));
      } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
      setMenu(null); stage.current?.focus(); return;
    }
    setRangeClip(null);
    try {
      if (cell && !cell.nodeId) {
        if (cell.kind !== 'wire') return;
        const clip = { node: { kind: 'wire' as const, id: crypto.randomUUID(), connected: true }, network: false, cut: false, origin };
        if (cut) void perform((p, n) => { const at = materializeCell(p, n, cell, () => crypto.randomUUID()); return editStructured(at.project, n, { kind: 'update', nodeId: at.selectedId, node: {kind:'wire',id:at.selectedId,connected:false,erased:true} }); }).then(() => clipboard.set(clip)).catch(() => undefined);
        else clipboard.set(clip);
        setMenu(null); stage.current?.focus(); return;
      }
      const clip = captureSelection(project, network.id, selection.node.id, origin, cut);
      if (cut) void perform((p, n) => editStructured(p, n, { kind: 'remove', nodeId: selection.node.id })).then(() => clipboard.set(clip)).catch(() => undefined);
      else clipboard.set(clip);
    } catch (e) { setError(String(e)); }
    setMenu(null); stage.current?.focus();
  }
  function paste(duplicate = false) {
    if (!selection || !network || disabled) return;
    if (rangeClip && !duplicate) {
      const at = cellSelection ? normalizeCellRange(cellSelection) : cell ? {top:cell.row,left:cell.column} : null;
      if (!at) { setError('Select the destination cell.'); return; }
      void perform((p,n) => pasteRange(p,n,{row:at.top,column:at.left},rangeClip,origin,()=>crypto.randomUUID())).then(() => {setRangeClip({...rangeClip,cut:false});setCellSelection(null);stage.current?.focus();}).catch(()=>undefined);
      setMenu(null); return;
    }
    if (multipleCells) {setError('Copy the range before pasting.');return;}
    const clip = duplicate ? cell && !cell.nodeId ? { node: {kind:'wire' as const,id:crypto.randomUUID(),connected:cell.connected ?? false},network:false,cut:false,origin } : captureSelection(project, network.id, selection.node.id, origin) : clipboard.clip;
    if (!clip) return;
    void perform((p, n) => { const at = cell && !cell.nodeId ? materializeCell(p, n, cell, () => crypto.randomUUID()) : {project:p,selectedId:selection.node.id}; return pasteSelection(at.project, n, at.selectedId, clip, origin, position, () => crypto.randomUUID()); }).then(() => { if (!duplicate) clipboard.set({ ...clip, cut: false }); stage.current?.focus(); }).catch(() => undefined);
    setMenu(null);
  }
  function editSymbol(networkId = network?.id, nodeId = selection?.node.id, explicit = false) {
    if (disabled || multipleCells || networkId === undefined) return;
    if(!nodeId || cell && !cell.nodeId && !explicit){openTool('contact','');return;}
    selectNetwork(networkId); setSelectedId(nodeId);
    const node = project.programs[0].networks.find(n => n.id === networkId)?.root;
    const selected = node && listNodes(node).find(n => n.node.id === nodeId);
    if(selected?.node.kind==='wire'){openTool('contact','');return;}
    if (selected && !childNodes(selected.node)) setEditing({ networkId, nodeId }); else focusProperties();
    setMenu(null);
  }
  const editingNode = editing && project.programs[0].networks.find(n => n.id === editing.networkId);
  const dialogNode = editingNode && listNodes(editingNode.root).find(n => n.node.id === editing?.nodeId)?.node;
  useEffect(() => { setEditing(null); setMenu(null); }, [projectId, state.apiUrl]);
  useEffect(() => { if (editing && editing.networkId !== selectedNetworkId) setEditing(null); }, [selectedNetworkId, editing]);
  useEffect(() => { if (editing) requestAnimationFrame(() => document.querySelector<HTMLInputElement>('.editor-symbol-dialog input')?.focus()); }, [editing]);
  const matches = query.trim() ? networks.flatMap(rung => listNodes(rung.root).filter(n => !childNodes(n.node) && nodeLabel(n.node).toUpperCase().includes(query.trim().toUpperCase())).map(n => ({ networkId: rung.id, node: n.node }))) : [];
  function findNext(direction = 1) {
    if (!matches.length) return;
    const index = matches.findIndex(m => m.networkId === selectedNetworkId && m.node.id === selectedId);
    const match = matches[(index + direction + matches.length) % matches.length];
    selectNetwork(match.networkId); setSelectedId(match.node.id);
  }
  useEffect(() => { if (finding) searchRef.current?.focus(); }, [finding]);
  useEffect(() => {
    if (!menu) return;
    document.querySelector<HTMLButtonElement>('.editor-context-menu button')?.focus();
    const dismiss = (e: PointerEvent) => { if (!(e.target as HTMLElement).closest('.editor-context-menu')) setMenu(null); };
    document.addEventListener('pointerdown', dismiss); return () => document.removeEventListener('pointerdown', dismiss);
  }, [menu]);
  useEffect(() => {
    const focus=compileState.focus;if(!focus)return;
    setCellSelection(null);setCursor(null);setSelectedId(focus.nodeId??null);
    requestAnimationFrame(()=>{stage.current?.querySelector(`[data-node-id="${CSS.escape(focus.nodeId??'')}"]`)?.scrollIntoView({block:'nearest',inline:'nearest'});stage.current?.focus();});
  },[compileState.focus]);
  const currentIndex = networks.findIndex(n => n.id === network?.id);
  return <section className="ladder-editor-workspace classic-editor" aria-label="Ladder editor" onKeyDown={e => {
    if (e.key === 'Escape' && (entry || editing)) { e.preventDefault(); setEntry(null); setEditing(null); stage.current?.focus(); return; }
    if (e.key === 'Escape' && !menu && !finding && (showCompileResults || compileState.error)) { e.preventDefault(); closeCompileResults(); return; }
    if (e.key === 'Escape') { setEntry(null); setEditing(null); setMenu(null); setFinding(false); setCellSelection(null); setCursor(null); setSelectedId(null); stage.current?.focus(); return; }
    const target = e.target as HTMLElement;
    if (target.closest('[role="dialog"]')) return;
    if (target.closest('input,select,textarea,[contenteditable="true"]')) return;
    if (target.closest('button') && !e.ctrlKey && !e.metaKey) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (!disabled) void (e.shiftKey ? redoProject() : undoProject()).catch(err => setError(String(err))); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); if (!disabled) void redoProject().catch(err => setError(String(err))); return; }
    if ((e.ctrlKey || e.metaKey) && ['c', 'x', 'v', 'd'].includes(e.key.toLowerCase())) {
      e.preventDefault(); if (e.key.toLowerCase() === 'c') copy(); if (e.key.toLowerCase() === 'x') copy(true); if (e.key.toLowerCase() === 'v') paste(); if (e.key.toLowerCase() === 'd') paste(true); return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); setFinding(true); return; }
    if (e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      e.preventDefault(); if (selection && grid && !disabled && !multipleCells && !e.repeat) {
        let destination: CellCursor = cell ?? { row: 0, column: 0 };
        void perform((p, n) => { const result = editGridWire(p, n, destination, e.key.slice(5).toLowerCase() as WireDirection, () => crypto.randomUUID()); destination = result.cursor; return result; }).then(() => { setCursor({ ...destination, networkId: network.id }); setCellSelection({networkId: network.id, anchor: destination, focus: destination}); stage.current?.focus(); }).catch(() => undefined);
      } return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const shortcuts:Record<string,EditorTool>={F5:'contact',F6:'nc',F7:'coil',F8:'instruction'};
    if(shortcuts[e.key]){e.preventDefault();openTool(shortcuts[e.key]);return;}
    if(e.key==='Insert'){e.preventDefault();setEntryMode(m=>m==='insert'?'overwrite':'insert');return;}
    if (e.key === 'Delete') { e.preventDefault(); remove(); }
    if (e.key === 'Enter') { e.preventDefault(); editSymbol(); }
    if(e.key.length===1 && /[a-z0-9]/i.test(e.key)){e.preventDefault();openTool(e.key.toUpperCase()==='Y'?'coil':'contact',e.key.toUpperCase());return;}
    if (grid && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
      e.preventDefault(); const current = cell ?? { row: 0, column: 0 };
      let row = current.row + (e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0);
      const column = e.key === 'Home' ? 0 : e.key === 'End' ? grid.columns - 1 : Math.max(0, Math.min(grid.columns - 1, current.column + (e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0)));
      if (row < 0 || row >= grid.rows) {
        const adjacent = networks[currentIndex + (row < 0 ? -1 : 1)];
        if (adjacent) { const other = layoutLadder(adjacent.root); row = row < 0 ? other.rows - 1 : 0; selectCell(adjacent.id, other.cells.find(c => c.row === row && c.column === Math.min(column, other.columns - 1))!,e.shiftKey); }
      } else selectCell(network.id, grid.cells.find(c => c.row === row && c.column === column)!,e.shiftKey);
    }
  }}>
    <div className="editor-toolbars">
      <div className="ide-menubar" aria-label="Editor menu">
        <details><summary>Edit</summary><div><button disabled={disabled} onClick={()=>copy()}>Copy · Ctrl+C</button><button disabled={disabled} onClick={()=>copy(true)}>Cut · Ctrl+X</button><button disabled={disabled || (!clipboard.clip && !rangeClip)} onClick={()=>paste()}>Paste · Ctrl+V</button><button disabled={disabled} onClick={remove}>Delete</button></div></details>
        <details><summary>Input</summary><div>{tools.map(t=><button key={t.tool} disabled={disabled || multipleCells} onClick={()=>openTool(t.tool)}>{t.label}</button>)}</div></details>
        <details><summary>View</summary><div><button onClick={()=>setShowProperties(v=>!v)}>Properties</button><button onClick={()=>setZoom(100)}>Actual size · 100%</button><button disabled={!hasCompileResults} onClick={e=>{setDismissedCompile(null);e.currentTarget.closest('details')?.removeAttribute('open');}}>Compile results</button></div></details>
        <button disabled={disabled || compileState.busy || state.dirty} onClick={()=>void compileState.compile()}>Compile</button>
        <span className="ide-menu-context">Main · Ladder</span>
      </div>
      <div className="editor-toolbar" role="toolbar" aria-label="Ladder tools">
        <button className="tool" aria-label="Compile project" disabled={disabled || compileState.busy || state.dirty} onClick={()=>void compileState.compile()}>{compileState.busy?'Compiling…':'Compile'}<small>{compileStatus}</small></button>
        <button title="Select (Esc)" aria-label="Select tool" onClick={() => setEntry(null)} className={!entry ? 'tool active' : 'tool'}><MousePointer2 size={16}/></button>
        <span className="tool-divider"/>
        {tools.map(t => <button key={t.tool} className={entry === t.tool ? 'tool symbol-tool active' : 'tool symbol-tool'} disabled={disabled || multipleCells} aria-label={`Insert ${t.label}`} title={`${t.label}${t.tool==='contact'?' (F5)':t.tool==='nc'?' (F6)':t.tool==='coil'?' (F7)':t.tool==='instruction'?' (F8)':''}`} onClick={() => openTool(t.tool)}><b>{t.glyph}</b><small>{t.tool==='contact'?'F5':t.tool==='nc'?'F6':t.tool==='coil'?'F7':t.tool==='instruction'?'F8':t.label}</small></button>)}
        <span className="tool-divider"/>
        <button className="tool" disabled={disabled || !selection?.parent} title="Add parallel branch around selection" aria-label="Add parallel branch" onClick={() => { if (!selection) return; if (selection.node.kind === 'action' || selection.node.kind === 'parallel' && selection.node.branches.every(n => n.kind === 'action')) openTool('coil'); else mutate({ kind: 'wrap', nodeId: selection.node.id, group: 'parallel', containerId: crypto.randomUUID(), branchId: crypto.randomUUID() }); }}><GitBranch size={17}/><small>Branch</small></button>
        <button className="tool" disabled={disabled || !cellSelection && !selection?.parent} title={multipleCells ? `Delete ${selectedCellCount} selected cells` : "Delete selected element"} aria-label="Delete element" onClick={remove}><Trash2 size={16}/></button>
        <button className="tool" disabled={disabled || !history.can_undo} title="Undo (Ctrl+Z)" aria-label="Undo edit" onClick={() => void undoProject().catch(e => setError(String(e)))}><Undo2 size={17}/></button>
        <button className="tool" disabled={disabled || !history.can_redo} title="Redo (Ctrl+Shift+Z)" aria-label="Redo edit" onClick={() => void redoProject().catch(e => setError(String(e)))}><Redo2 size={17}/></button>
        <span className="tool-divider"/>
        <button className="tool" disabled={disabled} aria-label="Copy selection" title="Copy (Ctrl+C) — editor clipboard" onClick={() => copy()}>Copy</button>
        <button className="tool" disabled={disabled || !selection?.parent} aria-label="Cut selection" title="Cut (Ctrl+X)" onClick={() => copy(true)}>Cut</button>
        <button className="tool" disabled={disabled || (!clipboard.clip && !rangeClip)} aria-label="Paste selection" title="Paste (Ctrl+V)" onClick={() => paste()}>Paste</button>
        <button className="tool" disabled={disabled || multipleCells} aria-label="Duplicate selection" title="Duplicate element or selected network (Ctrl+D)" onClick={() => paste(true)}>Duplicate</button>
        <span className="tool-divider"/>
        <button className="tool" disabled={zoom <= 60} title="Zoom out" aria-label="Zoom out" onClick={() => setZoom(Math.max(60, zoom - 10))}><ZoomOut size={16}/></button>
        <button className="tool" title="Find device or instruction (Ctrl+F)" aria-label="Find in ladder" onClick={() => setFinding(value => !value)}><Search size={16}/></button>
        <span className="zoom-label">{zoom}%</span><button className="tool" aria-label="Toggle properties" aria-pressed={showProperties} onClick={()=>setShowProperties(v=>!v)}>Properties</button>
        <button className="tool" aria-label="Toggle entry mode" title="Toggle overwrite / insert (Insert key)" onClick={()=>setEntryMode(m=>m==='insert'?'overwrite':'insert')}>{entryMode==='insert'?'Insert':'Overwrite'}</button>
        <button className="tool" disabled={zoom >= 150} title="Zoom in" aria-label="Zoom in" onClick={() => setZoom(Math.min(150, zoom + 10))}><ZoomIn size={16}/></button>
      </div>
      <div className="editor-program-strip"><span className="program-tab">Main</span><span>{project.plc.model}</span><span className="editor-save-state" role="status">{busy ? 'Saving…' : !connected ? 'Disconnected' : storageMode === 'database' ? `r${state.revision ?? '—'} · ${state.saveStatus}` : 'Local workspace'}</span><button disabled={disabled} onClick={() => networkEdit('add')}><Plus size={13}/> Network</button><button disabled={disabled || currentIndex <= 0} title="Move network up" aria-label="Move network up" onClick={() => networkEdit('move', -1)}><ArrowUp size={13}/></button><button disabled={disabled || currentIndex === networks.length - 1} title="Move network down" aria-label="Move network down" onClick={() => networkEdit('move', 1)}><ArrowDown size={13}/></button><button disabled={disabled || networks.length <= 1} title="Delete network" aria-label="Delete network" onClick={() => { if (confirm('Delete the selected network? Undo can restore it.')) networkEdit('delete'); }}><Trash2 size={13}/></button></div>
      {entry && <div className="editor-dialog-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setEntry(null);}}><form className="editor-command-entry ide-entry-dialog" role="dialog" aria-modal="true" aria-label="Enter symbol" onSubmit={e => {
        e.preventDefault();
        const rungId=network.id;
        void perform((p,n)=>enterAtCell(p,n,cell,selectedId,toolElement(entry,input,()=>crypto.randomUUID()),entryMode,position,()=>crypto.randomUUID())).then(result=>{
          setEntry(null);
          const layout=layoutLadder(result.project.programs[0].networks.find(n=>n.id===rungId)!.root);
          const inserted=layout.cells.filter(c=>c.nodeId===result.selectedId);
          if(entryMode==='overwrite' && inserted.length){const first=inserted[0],next=layout.cells.find(c=>c.row===first.row && c.column===Math.min(layout.columns-1,Math.max(...inserted.map(c=>c.column))+1));if(next)selectCell(rungId,next);}
          stage.current?.focus();
        }).catch(()=>undefined);
      }}>
        <div className="ide-dialog-title"><strong>Enter symbol</strong><button type="button" aria-label="Close symbol input" onClick={()=>setEntry(null)}>×</button></div>
        <div className="ide-entry-body"><label>Symbol<select aria-label="Symbol type" value={entry} onChange={e=>setEntry(e.target.value as EditorTool)}>{tools.map(t=><option key={t.tool} value={t.tool}>{t.label}</option>)}</select></label>
        <label>Device / instruction<input ref={inputRef} aria-label="Element address or instruction" value={input} onChange={e=>setInput(e.target.value)} disabled={disabled} autoComplete="off"/></label>
        <p>Network {currentIndex+1} · Row {(cell?.row??0)+1} · Column {cell?.column??0} · {entryMode}</p>
        {entryMode==='insert' && <label>Position<select value={position} onChange={e=>setPosition(e.target.value as 'before'|'after')}><option value="before">Before selected</option><option value="after">After selected</option></select></label>}
        {error && <p role="alert">{error}</p>}
        <div className="ide-entry-actions"><button disabled={disabled} type="submit">OK ↵</button><button type="button" onClick={()=>{setEntry(null);stage.current?.focus();}}>Cancel</button></div></div>
      </form></div>}
      {finding && <form className="editor-command-entry" onSubmit={e => { e.preventDefault(); findNext(); }}><label>Find in ladder<input ref={searchRef} aria-label="Find device or instruction" value={query} onChange={e => setQuery(e.target.value)} placeholder="X0, T0, MOV…"/></label><span role="status">{matches.length} matches</span><button type="button" disabled={!matches.length} onClick={() => findNext(-1)}>Previous</button><button disabled={!matches.length}>Next</button><button type="button" onClick={() => { setFinding(false); stage.current?.focus(); }}>Close search</button></form>}
      {(!entry && error || state.saveError) && <div className="editor-error" role="alert">{error || state.saveError}<button onClick={() => { if (state.saveError) void state.saveProject().catch(e => setError(String(e))); else setError(''); }}>{state.saveError ? 'Retry save' : 'Dismiss'}</button></div>}
    </div>
    <div className={showProperties ? "editor-split" : "editor-split properties-collapsed"}>
      <div className="editor-stage" ref={stage} tabIndex={0} aria-label="Ladder canvas">
        <div className="editor-sheet" style={{ zoom: zoom / 100, width: sheetWidth }}>
          <div className="editor-ruler" style={{ gridTemplateColumns: `56px ${GRID_X}px repeat(${Math.max(10, ...networks.map(n => layoutLadder(n.root).columns))}, ${COLUMN_WIDTH}px)` }}><span>Network</span><span/>{Array.from({ length: Math.max(10, ...networks.map(n => layoutLadder(n.root).columns)) }, (_, n) => <span key={n} data-ruler-column={n}>{n}</span>)}</div>
          {!networks.length && <div className="editor-empty">Create or load a project to begin editing.</div>}
          {networks.map((rung, index) => <article key={rung.id} className={rung.id === network?.id ? 'editor-rung selected-rung' : 'editor-rung'}>
            <button className="rung-gutter" aria-label={`Select network ${index + 1}`} aria-pressed={rung.id === network?.id} onClick={() => { selectNetwork(rung.id); setCellSelection(null); setCursor(null); setSelectedId(rung.root.id); }}><strong>{index + 1}</strong><small>N{rung.id}</small></button>
            <div className="rung-body"><button className="rung-comment" onClick={() => { selectNetwork(rung.id); setCellSelection(null); setCursor(null); setSelectedId(rung.root.id); }}>{rung.comment || `Network ${index + 1}`}</button>
              <LadderRenderer root={rung.root} diagnosticNodeIds={showCompileResults && compiledCurrent ? compileState.run!.diagnostics.filter(d=>d.networkId===rung.id && d.severity==='error').map(d=>d.nodeId!).filter(Boolean) : []} theme="dark" minWidth={sheetWidth - 56} selectedId={rung.id === network?.id ? selectedId : null} cursor={cursor?.networkId === rung.id ? cursor : null} selectionRange={cellSelection?.networkId === rung.id ? cellSelection : null} onCellSelect={(cell, extend) => selectCell(rung.id, cell, extend)} onCellEdit={cell=>{selectCell(rung.id,cell);openTool('contact','');}} onCellPointerDown={(cell, extend) => beginCellSelection(rung.id, cell, extend)} onCellPointerMove={cell => extendCellSelection(rung.id, cell)} onCellPointerUp={finishCellSelection} onSelect={id => { setCellSelection(null); setCursor(null); if (rung.id !== selectedNetworkId) { selectNetwork(rung.id); } setSelectedId(id); }} onEdit={id => editSymbol(rung.id, id, true)} onContextMenu={(id, x, y) => { const inRange=cellSelection?.networkId===rung.id && layoutLadder(rung.root).cells.some(c=>c.nodeId===id && cellIsInRange(c,cellSelection)); if(!inRange){setCellSelection(null);setCursor(null);setSelectedId(id);} selectNetwork(rung.id); setMenu({ x: Math.max(0, Math.min(x, window.innerWidth - 180)), y: Math.max(0, Math.min(y, window.innerHeight - 280)) }); }}/>
            </div>
          </article>)}
          <div className="editor-end"><span>END</span></div>
        </div>
      </div>
      <aside className="editor-properties" hidden={!showProperties} ref={properties} aria-label="Element properties">
        <div className="properties-title">Properties<span>{network ? `Network ${currentIndex + 1}` : ''}</span></div>
        {multipleCells && <div role="status"><h3>{selectedCellCount} cells selected</h3><p>Press Delete to clear every symbol and wire in this range as one undoable edit. Press Esc to cancel the selection.</p></div>}
        {selection && !multipleCells && <>
          <h3>{cell && !cell.nodeId ? `${cell.kind === "wire" ? "Wire" : "Empty cell"} · column ${cell.column}` : nodeLabel(selection.node)}</h3>
          {cell && !cell.nodeId ? <p>Select a tool to place a symbol here. Ctrl+arrows draws a connected wire one cell at a time.</p> : <Inspector key={`${network?.id}:${selection.node.id}`} node={selection.node} disabled={disabled} onUpdate={node => perform((p, n) => editStructured(p, n, { kind: 'update', nodeId: node.id, node }), false).then(() => undefined)}/>}
          <div className="property-order"><button disabled={disabled || cell && !cell.nodeId || !selection.parent || selection.index === 0} title="Move element earlier" aria-label="Move element earlier" onClick={() => mutate({ kind: 'move', nodeId: selection.node.id, direction: -1 })}><ArrowLeft size={14}/></button><button disabled={disabled || cell && !cell.nodeId || !selection.parent || selection.index === childNodes(selection.parent)!.length - 1} title="Move element later" aria-label="Move element later" onClick={() => mutate({ kind: 'move', nodeId: selection.node.id, direction: 1 })}><ArrowRight size={14}/></button><span>Execution order</span></div>
          <label className="rung-label">Network label<input aria-label="Network label" value={comment} disabled={disabled} onChange={e => setComment(e.target.value)} onBlur={() => { if (comment !== (network?.comment ?? '')) void perform(p => { const result = editNetwork(p, { kind: 'comment', networkId: selectedNetworkId, comment }); return { project: result.project, selectedId: selection.node.id }; }).catch(() => undefined); }}/></label>
          <details className="structure-details"><summary>Rung structure</summary>{nodes.map(l => <button key={l.node.id} onClick={() => { setCellSelection(null); setCursor(null); setSelectedId(l.node.id); }} style={{ paddingLeft: 8 + l.depth * 12 }} className={l.node.id === selection.node.id ? 'chosen' : ''}>{nodeLabel(l.node)}</button>)}</details>
        </>}
        {!selection && !multipleCells && <p>Select a rung or symbol.</p>}
      </aside>
    </div>
    {menu && <div className="editor-context-menu" role="menu" aria-label="Element actions" onKeyDown={e => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); const items = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')); const index = items.indexOf(document.activeElement as HTMLButtonElement); items[(index + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus(); } }} style={{ left: menu.x, top: menu.y }} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setMenu(null); }}>
      <button role="menuitem" onClick={() => editSymbol()}>Edit · Enter</button><button role="menuitem" onClick={() => copy()}>Copy · Ctrl+C</button><button role="menuitem" disabled={!selection?.parent} onClick={() => copy(true)}>Cut · Ctrl+X</button><button role="menuitem" disabled={!clipboard.clip && !rangeClip} onClick={() => paste()}>Paste · Ctrl+V</button><button role="menuitem" onClick={() => paste(true)}>Duplicate · Ctrl+D</button><button role="menuitem" disabled={!selection?.parent} onClick={() => { remove(); setMenu(null); }}>Delete</button><button role="menuitem" onClick={() => setMenu(null)}>Close · Esc</button>
    </div>}
    {dialogNode && <div className="editor-dialog-backdrop" onClick={e => { if (e.target === e.currentTarget) setEditing(null); }}><section className="editor-symbol-dialog" role="dialog" aria-modal="true" aria-label="Edit symbol" onKeyDown={e => { if (e.key === 'Tab') { const controls = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('input,select,button')).filter(el => !el.hasAttribute('disabled')); const first = controls[0], last = controls.at(-1); if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); } } }}><h3>Edit {nodeLabel(dialogNode)}</h3><Inspector node={dialogNode} disabled={disabled} onUpdate={async node => { await perform((p, n) => editStructured(p, n, { kind: 'update', nodeId: node.id, node }), false); setEditing(null); stage.current?.focus(); }}/><button onClick={() => { setEditing(null); stage.current?.focus(); }}>Cancel</button></section></div>}
    {compileState.error && <div role="alert" className="editor-error">{compileState.error}<button aria-label="Dismiss compile error" onClick={closeCompileResults}>Close ×</button></div>}
    {showCompileResults && compileState.run && <section className="compile-diagnostics" aria-label="Compile diagnostics">
      <div className="compile-diagnostics-header"><div><b>{compiledCurrent ? `Compile ${compileState.run.status}` : 'Compile Required · previous results are stale'}</b>
        <span> {compileState.run.diagnostics.filter(d=>d.severity==='error').length} errors · {compileState.run.diagnostics.filter(d=>d.severity==='warning').length} warnings</span></div>
        <button aria-label="Close compile results" title="Close compile results (Esc)" onClick={closeCompileResults}>Close ×</button>
      </div>
      <div className="compile-diagnostics-list">
        {compileState.run.diagnostics.map((d,i)=><button key={i} className={`diagnostic-${d.severity}`} disabled={!compiledCurrent || d.networkId===undefined} onClick={()=>compileState.locate(d.networkId!,d.nodeId)}><b>{d.severity.toUpperCase()} · {d.code}</b> {d.message}{d.networkId!==undefined?` · Network ${networks.findIndex(n=>n.id===d.networkId)+1}`:''}</button>)}
        <details><summary>Compile history ({compileState.runs.length})</summary>{compileState.runs.map(r=><p key={r.id}>{r.startedAt} · {r.status} · {r.revision?`Revision ${r.revision}`:'Local snapshot'}</p>)}</details>
      </div>
    </section>}
    <div className="editor-statusbar"><span>{network ? `Main / Network ${currentIndex + 1}` : 'Main'}</span><span>{multipleCells ? `${selectedCellCount} cells selected` : cell ? `Row ${cell.row + 1} · Column ${cell.column}` : selection ? nodeLabel(selection.node) : 'Select a cell'}</span><span>Drag / Shift+click select · Shift+arrows select · Ctrl+C/X/V · F5/F6/F7/F8 input</span><span>Compile {compileStatus}</span></div>
  </section>;
}
