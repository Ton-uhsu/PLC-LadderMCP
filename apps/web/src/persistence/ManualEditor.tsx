import { useEffect, useState } from 'react';
import { childNodes, editStructured, listNodes, fx3uVerifiedForms, type LogicNode, type StructuredEdit } from '@plc-ladder-mcp/ladder-ir';
import { useProjectStore } from '../store';
import { nodeLabel } from '../editor/layout';
import { newElement, operandInput, readOperand, type NewElement, type OperandInput } from '../editor/inspector';

function Inspector({ node, disabled, onUpdate }: { node: LogicNode; disabled: boolean; onUpdate: (node: LogicNode) => Promise<void> }) {
  const [draft, setDraft] = useState(() => structuredClone(node));
  const [operands, setOperands] = useState<OperandInput[]>(node.kind === 'action' && node.action.kind === 'instruction' ? node.action.operands.map(operandInput) : []);
  const [error, setError] = useState('');
  useEffect(() => {
    setDraft(structuredClone(node)); setError('');
    setOperands(node.kind === 'action' && node.action.kind === 'instruction' ? node.action.operands.map(operandInput) : []);
  }, [node]);
  if (childNodes(node)) return <p>Select a child to edit its properties, or insert an element into this group. Series children execute in array order; parallel entries are branches.</p>;
  return <form className="element-inspector" onSubmit={async e => {
    e.preventDefault(); setError('');
    try {
      const next = structuredClone(draft);
      if (next.kind === 'action' && next.action.kind === 'instruction') {
        next.action.opcode = next.action.opcode.trim().toUpperCase();
        if (!next.action.opcode) throw new Error('Instruction opcode is required.');
        next.action.operands = operands.map(readOperand);
      }
      await onUpdate(next);
    } catch (error) { setError(String(error)); }
  }}>
    {draft.kind === 'contact' && <>
      <label>Device<input required value={draft.device.address} disabled={disabled} onChange={e => setDraft({ ...draft, device: { kind: 'device', address: e.target.value } })}/></label>
      <label>Contact mode<select value={draft.mode} disabled={disabled} onChange={e => setDraft({ ...draft, mode: e.target.value as 'NO' | 'NC' })}><option>NO</option><option>NC</option></select></label>
      <label>Edge<select value={draft.edge ?? 'none'} disabled={disabled} onChange={e => setDraft({ ...draft, edge: e.target.value as 'none' | 'rising' | 'falling' })}><option value="none">None</option><option value="rising">Rising</option><option value="falling">Falling</option></select></label>
    </>}
    {draft.kind === 'action' && draft.action.kind !== 'instruction' && <>
      <label>Output type<select value={draft.action.kind} disabled={disabled} onChange={e => setDraft({ ...draft, action: { ...draft.action, kind: e.target.value as 'coil' | 'set' | 'reset', device: 'device' in draft.action ? draft.action.device : { kind: 'device', address: 'Y0' } } })}><option value="coil">OUT coil</option><option value="set">SET</option><option value="reset">RST</option></select></label>
      <label>Device<input required disabled={disabled} value={draft.action.device.address} onChange={e => { if (draft.action.kind !== 'instruction') setDraft({ ...draft, action: { ...draft.action, device: { kind: 'device', address: e.target.value } } }); }}/></label>
    </>}
    {draft.kind === 'action' && draft.action.kind === 'instruction' && <>
      <label>Instruction opcode<input required list="instruction-opcodes" disabled={disabled} value={draft.action.opcode} onChange={e => { if (draft.action.kind === 'instruction') setDraft({ ...draft, action: { ...draft.action, opcode: e.target.value } }); }}/></label>
      <datalist id="instruction-opcodes">{[...new Set(fx3uVerifiedForms.map(f => f.opcode))].map(opcode => <option key={opcode} value={opcode}/>)}</datalist>
      {operands.map((operand, index) => <div className="operand-row" key={index}>
        <label>Operand {index + 1} type<select disabled={disabled} value={operand.kind} onChange={e => setOperands(operands.map((o, i) => i === index ? { ...o, kind: e.target.value as OperandInput['kind'] } : o))}><option value="device">Device</option><option value="decimal">Decimal (K)</option><option value="hex">Hex (H)</option></select></label>
        <label>Operand {index + 1} value<input disabled={disabled} value={operand.value} onChange={e => setOperands(operands.map((o, i) => i === index ? { ...o, value: e.target.value } : o))}/></label>
        <button type="button" className="ghost" disabled={disabled} onClick={() => setOperands(operands.filter((_, i) => i !== index))}>Remove operand {index + 1}</button>
      </div>)}
      <button type="button" className="ghost" disabled={disabled} onClick={() => setOperands([...operands, { kind: 'device', value: 'D0' }])}>Add operand</button>
      <p>Timer/counter forms expose device and preset. Time-base and retentive options are not available. Opcode suggestions do not establish compatibility; Compile and target checks are separate.</p>
    </>}
    <button className="ghost" disabled={disabled}>Update element</button>
    {error && <p role="alert">{error}</p>}
  </form>;
}

export function ManualEditor({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string) => void }) {
  const { project, selectedNetworkId, editProject, projectId, switching, connected, storageMode } = useProjectStore();
  const network = project.programs[0]?.networks.find(n => n.id === selectedNetworkId);
  const [kind, setKind] = useState<NewElement>('contact'); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { setError(''); }, [projectId, selectedNetworkId]);
  if (!network) return null;
  const locations = listNodes(network.root);
  const selection = locations.find(l => l.node.id === selectedId) ?? locations[0];
  const { node, parent, index } = selection; const children = childNodes(node); const siblings = parent ? childNodes(parent)! : [];
  const disabled = busy || switching || !connected || (storageMode === 'database' && !projectId);
  async function run(edit: StructuredEdit) {
    if (disabled) return;
    setError(''); setBusy(true);
    const context = useProjectStore.getState();
    try {
      const next = editStructured(context.project, context.selectedNetworkId, edit);
      await editProject(next.project);
      const current = useProjectStore.getState();
      if (current.projectId === context.projectId && current.selectedNetworkId === context.selectedNetworkId && current.apiUrl === context.apiUrl && current.apiToken === context.apiToken) onSelect(next.selectedId);
    } catch (error) { setError(String(error)); throw error; }
    finally { setBusy(false); }
  }
  const invoke = (edit: StructuredEdit) => { void run(edit).catch(() => undefined); };
  const insertionParent = children ? node : parent;
  return <section className="manual-editor" aria-label="Manual Ladder editor">
    <h3>Structured Ladder editor</h3>
    <p>{storageMode === 'database' ? 'Applied edits autosave to the selected project revision.' : 'Applied edits save to the local development workspace.'} Draft save and session Undo/Redo do not imply Compile success.</p>
    <div className="structured-editor-grid">
      <div className="element-tree" role="group" aria-label="Ladder elements">
        {locations.map(l => <button key={l.node.id} className={l.node.id === node.id ? 'element-item selected' : 'element-item'} style={{ paddingLeft: 12 + l.depth * 14 }} disabled={busy || switching} onClick={() => onSelect(l.node.id)} aria-pressed={l.node.id === node.id}>
          <span>{nodeLabel(l.node)}</span><small>{l.node.id}</small>
        </button>)}
      </div>
      <div className="inspector-panel">
        <h4>{nodeLabel(node)}</h4><code className="element-id">{node.id}</code>
        <div className="element-actions">
          <button className="ghost" disabled={disabled || !parent || index === 0} onClick={() => invoke({ kind: 'move', nodeId: node.id, direction: -1 })}>Move earlier</button>
          <button className="ghost" disabled={disabled || !parent || index === siblings.length - 1} onClick={() => invoke({ kind: 'move', nodeId: node.id, direction: 1 })}>Move later</button>
          <button className="ghost" disabled={disabled || !parent} onClick={() => { if (confirm('Remove this element and its children? Use Undo to recover it.')) invoke({ kind: 'remove', nodeId: node.id }); }}>Remove element</button>
          <button className="ghost" disabled={disabled} onClick={() => invoke({ kind: 'wrap', nodeId: node.id, group: 'series', containerId: crypto.randomUUID() })}>Wrap in series</button>
          <button className="ghost" disabled={disabled} onClick={() => invoke({ kind: 'wrap', nodeId: node.id, group: 'parallel', containerId: crypto.randomUUID(), branchId: crypto.randomUUID() })}>Wrap in parallel</button>
        </div>
        <Inspector node={node} disabled={disabled} onUpdate={updated => run({ kind: 'update', nodeId: node.id, node: updated })}/>
        <div className="element-insert">
          <label>New element<select value={kind} disabled={disabled} onChange={e => setKind(e.target.value as NewElement)}>
            <option value="contact">Contact (NO / NC)</option><option value="coil">OUT coil</option><option value="set">SET</option><option value="reset">RST</option><option value="timer">Timer (OUT T)</option><option value="counter">Counter (OUT C)</option><option value="instruction">Instruction</option><option value="series">Series group</option><option value="parallel">Parallel group</option>
          </select></label>
          <button className="ghost" disabled={disabled || !insertionParent} onClick={() => { if (insertionParent) invoke({ kind: 'insert', parentId: insertionParent.id, index: children ? children.length : index + 1, node: newElement(kind, () => crypto.randomUUID()) }); }}>{children ? node.kind === 'parallel' ? 'Add branch' : 'Append to series' : 'Insert after element'}</button>
        </div>
        {error && <p role="alert">{error}</p>}
      </div>
    </div>
  </section>;
}
