import type { LadderProjectV02 } from '@plc-ladder-mcp/ladder-ir';
export type ExportTarget = 'gxworks2' | 'samsoar2022' | null;
type Draft = { project: LadderProjectV02; defaultExportTarget: ExportTarget };
export type ProjectSummary = { id: string; name: string; revision_no: string };
export type Revision = { project_id: string; revision_no: string; ir_snapshot: LadderProjectV02; default_export_target?: ExportTarget };
export type SaveBody = { baseRevision: string; requestId: string; snapshot: LadderProjectV02; defaultExportTarget?: ExportTarget };
export interface ProjectApi {
  list(): Promise<ProjectSummary[]>;
  read(id: string): Promise<Revision>;
  create(snapshot: LadderProjectV02): Promise<Revision>;
  save(id: string, body: SaveBody): Promise<Revision>;
}
export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export type WorkspaceState = {
  projectId: string | null; revision: string | null; project: LadderProjectV02 | null;
  defaultExportTarget: ExportTarget; projects: ProjectSummary[]; dirty: boolean; switching: boolean;
  saveStatus: 'saved' | 'pending' | 'saving' | 'error' | 'conflict'; error: string;
  undo: Draft[]; redo: Draft[];
};

// One serialized save stream. Each transport retry retains the exact key/body.
export class DurableWorkspace {
  state: WorkspaceState = { projectId: null, revision: null, project: null, projects: [],
    defaultExportTarget: null, dirty: false, switching: false, saveStatus: 'saved', error: '', undo: [], redo: [] };
  private listeners = new Set<(state: WorkspaceState) => void>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private job: { id: string; body: SaveBody } | undefined;
  private running: Promise<void> | undefined;
  private epoch = 0;
  constructor(private api: ProjectApi, private delay = 500) {}
  subscribe(listener: (state: WorkspaceState) => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private update(patch: Partial<WorkspaceState>) { this.state = { ...this.state, ...patch }; this.listeners.forEach(fn => fn(this.state)); }
  private cancelTimer() { clearTimeout(this.timer); this.timer = undefined; }
  suspend() {
    this.cancelTimer(); this.epoch++;
    // Preserve an uncertain request and draft; retry uses the original key after login.
    if (this.state.dirty) this.update({ saveStatus: 'error', error: 'Sign in again to retry saving this draft.' });
  }
  reset() {
    this.suspend(); this.job = undefined;
    this.update({ projectId: null, revision: null, project: null, projects: [], dirty: false,
      defaultExportTarget: null, switching: false, saveStatus: 'saved', error: '', undo: [], redo: [] });
  }
  async refresh() { const epoch = this.epoch; const projects = await this.api.list(); if (epoch === this.epoch) this.update({ projects }); }
  edit(project: LadderProjectV02, recordUndo = true) {
    if (!this.state.projectId || this.state.switching) throw new Error('Select a project before editing.');
    if (JSON.stringify(project) === JSON.stringify(this.state.project)) return;
    this.update({ project: structuredClone(project), dirty: true,
      ...(recordUndo ? { undo: [...this.state.undo.slice(-49), this.frame()], redo: [] } : {}),
      ...(this.state.saveStatus === 'conflict' ? {} : { saveStatus: 'pending' }) });
    this.cancelTimer();
    if (this.state.saveStatus !== 'conflict') this.timer = setTimeout(() => { void this.flush().catch(() => undefined); }, this.delay);
  }
  private frame(): Draft { return { project: structuredClone(this.state.project!), defaultExportTarget: this.state.defaultExportTarget }; }
  editDefaultTarget(target: ExportTarget) {
    if (!this.state.projectId || this.state.switching) throw new Error('Select a project before editing.');
    if (target === this.state.defaultExportTarget) return;
    this.update({ undo: [...this.state.undo.slice(-49), this.frame()], redo: [], defaultExportTarget: target, dirty: true,
      ...(this.state.saveStatus === 'conflict' ? {} : { saveStatus: 'pending' }) });
    this.cancelTimer();
    if (this.state.saveStatus !== 'conflict') this.timer = setTimeout(() => { void this.flush().catch(() => undefined); }, this.delay);
  }
  undo() {
    const previous = this.state.undo.at(-1); if (!previous || this.state.switching) return;
    const current = this.frame(); const undo = this.state.undo.slice(0, -1);
    this.restoreDraft(previous); this.update({ undo, redo: [...this.state.redo, current] });
  }
  redo() {
    const next = this.state.redo.at(-1); if (!next || this.state.switching) return;
    const current = this.frame(); const redo = this.state.redo.slice(0, -1);
    this.restoreDraft(next); this.update({ redo, undo: [...this.state.undo, current] });
  }
  private restoreDraft(draft: Draft) {
    this.update({ defaultExportTarget: draft.defaultExportTarget });
    this.edit(draft.project, false);
    // Settings-only undo also needs a save when the IR itself did not change.
    this.update({ dirty: true, ...(this.state.saveStatus === 'conflict' ? {} : { saveStatus: 'pending' }) });
    this.cancelTimer();
    if (this.state.saveStatus !== 'conflict') this.timer = setTimeout(() => { void this.flush().catch(() => undefined); }, this.delay);
  }
  async flush(): Promise<void> {
    this.cancelTimer();
    if (this.state.saveStatus === 'conflict') throw new Error(this.state.error);
    if (this.running) { await this.running; if (this.state.dirty) return this.flush(); return; }
    const epoch = this.epoch;
    const run = async () => {
      while (this.state.dirty && epoch === this.epoch) {
        if (!this.job) this.job = { id: this.state.projectId!, body: {
          baseRevision: this.state.revision!, requestId: crypto.randomUUID(), snapshot: structuredClone(this.state.project!), defaultExportTarget: this.state.defaultExportTarget,
        } };
        const job = this.job;
        this.update({ saveStatus: 'saving', error: '' });
        try {
          const saved = await this.api.save(job.id, job.body);
          if (epoch !== this.epoch) return;
          if (saved.project_id !== job.id) throw new Error('Unexpected project returned by save.');
          this.job = undefined;
          const dirty = JSON.stringify(this.state.project) !== JSON.stringify(job.body.snapshot) || this.state.defaultExportTarget !== job.body.defaultExportTarget;
          this.update({ revision: saved.revision_no, dirty, saveStatus: dirty ? 'pending' : 'saved', error: '',
            projects: this.state.projects.map(p => p.id === job.id ? { ...p, name: job.body.snapshot.name, revision_no: saved.revision_no } : p) });
        } catch (error) {
          if (epoch !== this.epoch) return;
          const conflict = error instanceof ApiError && error.status === 409;
          // A definite 400 was rejected, so corrected edits may use a new request.
          if (error instanceof ApiError && [400, 413].includes(error.status)) this.job = undefined;
          this.update({ saveStatus: conflict ? 'conflict' : 'error', error: conflict
            ? 'The saved project changed. Your draft is retained. Download it before loading the latest revision.'
            : error instanceof Error ? error.message : String(error) });
          throw error;
        }
      }
    };
    const promise = run(); this.running = promise;
    try { await promise; } finally { if (this.running === promise) this.running = undefined; }
  }
  private adopt(revision: Revision) {
    this.job = undefined; this.epoch++;
    this.update({ projectId: revision.project_id, revision: revision.revision_no, project: revision.ir_snapshot, defaultExportTarget: revision.default_export_target ?? null,
      dirty: false, saveStatus: 'saved', error: '', undo: [], redo: [] });
  }
  async select(id: string) {
    if (this.state.switching) throw new Error('A project is already loading.');
    this.update({ switching: true });
    try { await this.flush(); const epoch = this.epoch; const revision = await this.api.read(id);
      if (epoch === this.epoch) this.adopt(revision);
    } finally { this.update({ switching: false }); }
  }
  async create(name: string) {
    if (this.state.switching) throw new Error('A project is already loading.');
    this.update({ switching: true });
    try {
      await this.flush(); const epoch = this.epoch;
      const revision = await this.api.create({ version: '0.2', name: name.trim() || 'Untitled PLC Project',
        plc: { family: 'Mitsubishi FX', model: 'FX3U' },
        programs: [{ name: 'Main', networks: [{ id: 0, root: { kind: 'series', id: crypto.randomUUID(), children: [] } }] }] });
      if (epoch === this.epoch) { this.adopt(revision); await this.refresh(); }
    } finally { this.update({ switching: false }); }
  }
  async reloadDiscardingDraft() {
    if (this.state.switching || this.running) throw new Error('Wait for the current request to finish.');
    this.cancelTimer(); this.update({ switching: true });
    try { const epoch = this.epoch; const revision = await this.api.read(this.state.projectId!);
      if (epoch === this.epoch) this.adopt(revision);
    } finally { this.update({ switching: false }); }
  }
}
