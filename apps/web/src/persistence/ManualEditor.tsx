import type { LogicNode } from '@plc-ladder-mcp/ladder-ir';
import { useProjectStore } from '../store';
export function ManualEditor() {
  const { project, selectedNetworkId, setProject, projectId, switching } = useProjectStore();
  const network = project.programs[0]?.networks.find(n => n.id === selectedNetworkId);
  if (!projectId || !network) return null;
  const nodes: LogicNode[] = [];
  function visit(n: LogicNode) { nodes.push(n); if (n.kind === 'series') n.children.forEach(visit); if (n.kind === 'parallel') n.branches.forEach(visit); }
  visit(network.root);
  function change(edit: (root: LogicNode) => void) {
    const next = structuredClone(project); const target = next.programs[0].networks.find(n => n.id === selectedNetworkId)!;
    edit(target.root); setProject(next);
  }
  function modify(id: string, edit: (node: LogicNode) => void) {
    change(root => { function walk(n: LogicNode) { if (n.id === id) edit(n); if (n.kind === 'series') n.children.forEach(walk); if (n.kind === 'parallel') n.branches.forEach(walk); } walk(root); });
  }
  return <section className="manual-editor" aria-label="Manual Ladder editor">
    <strong>Manual editing · autosave</strong>
    <label>Network comment<input disabled={switching} value={network.comment ?? ''} onChange={e => {
      const next = structuredClone(project); next.programs[0].networks.find(n => n.id === selectedNetworkId)!.comment = e.target.value; setProject(next);
    }}/></label>
    {nodes.map(node => node.kind === 'contact' ? <label key={node.id}>Contact
      <input aria-label={`Contact ${node.id} device`} disabled={switching} value={node.device.address}
        onChange={e => modify(node.id, n => { if (n.kind === 'contact') n.device.address = e.target.value; })}/>
      <select aria-label={`Contact ${node.id} mode`} disabled={switching} value={node.mode} onChange={e => modify(node.id, n => { if (n.kind === 'contact') n.mode = e.target.value as 'NO' | 'NC'; })}>
        <option>NO</option><option>NC</option>
      </select>
    </label> : node.kind === 'action' && node.action.kind !== 'instruction' ? <label key={node.id}>{node.action.kind.toUpperCase()}
      <input aria-label={`Action ${node.id} device`} disabled={switching} value={node.action.device.address}
        onChange={e => modify(node.id, n => { if (n.kind === 'action' && n.action.kind !== 'instruction') n.action.device.address = e.target.value; })}/>
    </label> : null)}
    {network.root.kind === 'series' && <div>
      <button disabled={switching} onClick={() => change(root => { if (root.kind === 'series') {
        const node: LogicNode = { kind: 'contact', id: crypto.randomUUID(), device: { kind: 'device', address: 'X0' }, mode: 'NO' };
        root.children.unshift(node);
      } })}>Add NO contact</button>
      <button disabled={switching} onClick={() => change(root => { if (root.kind === 'series') root.children.push({
        kind: 'action', id: crypto.randomUUID(), action: { kind: 'coil', id: crypto.randomUUID(), device: { kind: 'device', address: 'Y0' } },
      }); })}>Add output coil</button>
    </div>}
  </section>;
}
