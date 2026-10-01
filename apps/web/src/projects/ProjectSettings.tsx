import { useEffect, useState } from 'react';
import { useProjectStore } from '../store';
import type { ExportTarget } from '../persistence/workspace';
export function ProjectSettings() {
  const { project, projectId, revision, storageMode, defaultExportTarget, switching, connected, editProject, setDefaultExportTarget } = useProjectStore();
  const [name, setName] = useState(project.name); const [error, setError] = useState('');
  useEffect(() => { setName(project.name); setError(''); }, [projectId, project.name]);
  const unavailable = switching || !connected || (storageMode === 'database' && !projectId);
  return <section className="project-settings" aria-label="Project settings">
    <form onSubmit={async e => {
      e.preventDefault(); setError('');
      try { await editProject({ ...project, name: name.trim() }); }
      catch (error) { setError(String(error)); }
    }}>
      <h3>Project identity</h3>
      <label htmlFor="project-name">Project name</label>
      <input id="project-name" value={name} disabled={unavailable} onChange={e => setName(e.target.value)} required maxLength={200}/>
      <button className="ghost" disabled={unavailable || !name.trim() || name.trim() === project.name}>Update name</button>
      <p>{storageMode === 'database' ? `Project ${projectId ?? 'not selected'} · revision ${revision ?? '—'}` : 'Legacy local workspace · JSON persistence'}</p>
    </form>
    <div>
      <h3>PLC context</h3>
      <label htmlFor="project-plc">PLC family / model</label>
      <input id="project-plc" value={`${project.plc.family} / ${project.plc.model}`} readOnly/>
      <p>The PLC model is fixed for this project. Model conversion is not available. Selecting an export IDE leaves this model unchanged.</p>
      <label htmlFor="project-default-target">Default export target</label>
      <select id="project-default-target" value={defaultExportTarget ?? ''} disabled={unavailable || storageMode !== 'database'} onChange={e => {
        try { setDefaultExportTarget((e.target.value || null) as ExportTarget); setError(''); } catch (error) { setError(String(error)); }
      }}>
        <option value="">No default — choose at export time</option>
        <option value="gxworks2">GX Works2</option><option value="samsoar2022">SamSoar2022</option>
      </select>
      <p>{storageMode === 'database' ? 'Default target changes autosave. The export card can override the target for an individual export.' : 'Saving a project default target requires PostgreSQL. You can choose a target in the export card.'}</p>
    </div>
    {error && <p role="alert">{error}</p>}
  </section>;
}
