import { useEffect, useState } from 'react';
import { editNetwork, type NetworkEdit } from '@plc-ladder-mcp/ladder-ir';
import { useProjectStore } from '../store';
export function NetworkControls() {
  const { project, projectId, selectedNetworkId, connected, storageMode, switching, editProject, selectNetwork } = useProjectStore();
  const networks = project.programs[0]?.networks ?? [];
  const index = networks.findIndex(n => n.id === selectedNetworkId); const network = networks[index];
  const [comment, setComment] = useState(network?.comment ?? ''); const [error, setError] = useState('');
  useEffect(() => { setComment(network?.comment ?? ''); setError(''); }, [projectId, selectedNetworkId, network?.comment]);
  const disabled = switching || !connected || !project.programs[0] || (storageMode === 'database' && !projectId);
  async function run(edit: NetworkEdit) {
    setError('');
    try {
      const context = useProjectStore.getState();
      const next = editNetwork(context.project, edit);
      await editProject(next.project);
      const current = useProjectStore.getState();
      if (current.projectId === context.projectId && current.apiUrl === context.apiUrl && current.apiToken === context.apiToken) selectNetwork(next.selectedId);
    } catch (error) { setError(String(error)); }
  }
  return <section className="network-controls" aria-label="Network management">
    <div className="network-control-actions">
      <button className="ghost" disabled={disabled} onClick={() => void run({ kind: 'add', rootId: crypto.randomUUID() })}>Add network</button>
      <span>{network ? `Execution position ${index + 1} of ${networks.length} · stable ID ${network.id}` : 'Select a network'}</span>
      <button className="ghost" disabled={disabled || index <= 0} onClick={() => void run({ kind: 'move', networkId: selectedNetworkId, direction: -1 })}>Move up</button>
      <button className="ghost" disabled={disabled || index < 0 || index >= networks.length - 1} onClick={() => void run({ kind: 'move', networkId: selectedNetworkId, direction: 1 })}>Move down</button>
      <button className="ghost" disabled={disabled || !network || networks.length <= 1} onClick={() => {
        if (confirm(`Delete network ${selectedNetworkId}? Its logic will be removed from the current draft. Use Undo to recover it.`)) void run({ kind: 'delete', networkId: selectedNetworkId });
      }}>Delete network</button>
    </div>
    {network && <form onSubmit={e => { e.preventDefault(); void run({ kind: 'comment', networkId: selectedNetworkId, comment }); }}>
      <label htmlFor="network-comment">Network comment</label>
      <input id="network-comment" value={comment} disabled={disabled} onChange={e => setComment(e.target.value)}/>
      <button className="ghost" disabled={disabled || comment === (network.comment ?? '')}>Update comment</button>
    </form>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
