import { create } from "zustand";
import { parseGxWorks2ListText } from "@plc-ladder-mcp/ladder-ir";
import type { LadderProjectV02 } from "@plc-ladder-mcp/ladder-ir";
import { DurableWorkspace, type ExportTarget } from "./persistence/workspace";
import { projectApi } from "./persistence/api";
import { demoProject } from "./ladder";

const savedApi = localStorage.getItem("plc-ladder-api") ?? "";
const savedToken = sessionStorage.getItem("plc-ladder-token") ?? "";

export type PendingChange = {
  id: string;
  operation: string;
  summary: string;
  changes: Array<{ path: string; before: unknown; after: unknown }>;
  validation: {
    valid: boolean;
    issues: Array<{ severity: "error" | "warning"; code: string; message: string; path: string }>;
  };
  created_at: string;
  stale: boolean;
};

export type HistoryEntry = {
  id: string;
  kind: "change" | "undo" | "redo";
  operation: string;
  summary: string;
  source: "direct" | "approved" | "history";
  created_at: string;
};

export type HistoryState = {
  can_undo: boolean;
  can_redo: boolean;
  undo_count: number;
  redo_count: number;
  entries: HistoryEntry[];
};

export type SavedProject = { name: string; file: string; id?: string; revision_no?: string };

const emptyHistory: HistoryState = {
  can_undo: false,
  can_redo: false,
  undo_count: 0,
  redo_count: 0,
  entries: [],
};

type State = {
  defaultExportTarget: ExportTarget;
  setDefaultExportTarget: (target: ExportTarget) => void;
  editProject: (project: LadderProjectV02) => Promise<void>;
  storageMode: "legacy" | "database";
  projectId: string | null;
  revision: string | null;
  dirty: boolean;
  switching: boolean;
  saveStatus: "saved" | "pending" | "saving" | "error" | "conflict";
  saveError: string;
  reloadLatest: () => Promise<void>;
  project: LadderProjectV02;
  selectedNetworkId: number;
  apiUrl: string;
  apiToken: string;
  connected: boolean;
  pendingChanges: PendingChange[];
  loadingChanges: boolean;
  history: HistoryState;
  loadingHistory: boolean;
  savedProjects: SavedProject[];
  setProject: (project: LadderProjectV02) => void;
  createProject: (name: string) => Promise<void>;
  selectNetwork: (id: number) => void;
  setApiUrl: (url: string) => void;
  setApiToken: (token: string) => void;
  syncProject: () => Promise<void>;
  syncPendingChanges: () => Promise<void>;
  approvePendingChange: (id: string) => Promise<void>;
  rejectPendingChange: (id: string) => Promise<void>;
  syncHistory: () => Promise<void>;
  undoProject: () => Promise<void>;
  redoProject: () => Promise<void>;
  syncSavedProjects: () => Promise<void>;
  saveProject: (name?: string) => Promise<void>;
  loadProject: (name: string) => Promise<void>;
  importGxWorks2: (content: string) => Promise<void>;
};

async function readError(res: Response) {
  try {
    const data = await res.json() as { error?: string };
    return data.error ?? `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

function authHeaders(token: string, json = false): HeadersInit {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = "Bearer " + token;
  if (json) headers["content-type"] = "application/json";
  return headers;
}

function pickNetwork(project: LadderProjectV02, preferred: number) {
  const networks = project.programs[0]?.networks ?? [];
  return networks.some(network => network.id === preferred) ? preferred : (networks[0]?.id ?? 0);
}

export const useProjectStore = create<State>((set, get) => ({
  defaultExportTarget: null,
  setDefaultExportTarget: target => {
    if (get().storageMode !== "database") throw new Error("Default target persistence requires PostgreSQL.");
    durable.editDefaultTarget(target);
  },
  editProject: async project => {
    if (get().switching) throw new Error("Wait for the current project request.");
    if (get().storageMode === "database") { durable.edit(project); return; }
    const { apiUrl, apiToken, connected, project: baseSnapshot } = get();
    if (!connected) throw new Error("Connect to the local backend before editing.");
    set({ switching: true });
    try {
      const res = await fetch(`${apiUrl}/api/manual/project`, { method: "POST", headers: authHeaders(apiToken, true),
        body: JSON.stringify({ baseSnapshot, snapshot: project }) });
      if (!res.ok) throw new Error(await readError(res));
      const saved = await res.json() as { project: LadderProjectV02; history: HistoryState };
      if (get().apiUrl !== apiUrl || get().apiToken !== apiToken) return;
      set(state => ({ project: saved.project, history: saved.history, selectedNetworkId: pickNetwork(saved.project, state.selectedNetworkId) }));
      await get().syncPendingChanges();
    } finally { set({ switching: false }); }
  },
  storageMode: "legacy", projectId: null, revision: null, dirty: false, switching: false,
  saveStatus: "saved", saveError: "",
  reloadLatest: () => durable.reloadDiscardingDraft(),
  project: demoProject,
  selectedNetworkId: 0,
  apiUrl: savedApi,
  apiToken: savedToken,
  connected: false,
  pendingChanges: [],
  loadingChanges: false,
  history: emptyHistory,
  loadingHistory: false,
  savedProjects: [],

  setProject: (project) => {
    if (get().storageMode === "database") { durable.edit(project); return; }
    set(state => ({ project, selectedNetworkId: pickNetwork(project, state.selectedNetworkId) }));
  },

  createProject: async (name) => {
    if (get().storageMode === "database") { await durable.create(name); return; }
    if (get().switching) throw new Error("Wait for the current project request.");
    set({ switching: true });
    try {
      const clean = name.trim() || "Untitled PLC Project";
      const { apiUrl, apiToken } = get();
      if (!apiUrl) {
        const local = JSON.parse(JSON.stringify(demoProject)) as LadderProjectV02;
        local.name = clean;
        set({ project: local, selectedNetworkId: 0, pendingChanges: [], history: emptyHistory });
        return;
      }
      const res = await fetch(`${apiUrl}/api/project`, {
        method: "POST",
        headers: authHeaders(apiToken, true),
        body: JSON.stringify({ name: clean, plc_family: "Mitsubishi FX", plc_model: "FX3U" }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const project = await res.json() as LadderProjectV02;
      if (get().apiUrl !== apiUrl || get().apiToken !== apiToken) return;
      set({ project, selectedNetworkId: 0, pendingChanges: [], history: emptyHistory, connected: true });
      await Promise.all([get().syncSavedProjects(), get().syncHistory()]);
    } finally { set({ switching: false }); }
  },

  selectNetwork: (id) => set({ selectedNetworkId: id }),

  setApiUrl: (url) => {
    const clean = url.trim().replace(/\/$/, "");
    if (clean !== get().apiUrl && get().dirty) throw new Error("Download or save the current draft before changing servers.");
    if (clean !== get().apiUrl) durable.reset();
    localStorage.setItem("plc-ladder-api", clean);
    set({ apiUrl: clean, connected: false, pendingChanges: [], history: emptyHistory, savedProjects: [] });
  },

  setApiToken: (token) => {
    const clean = token.trim();
    if (clean !== get().apiToken) durable.suspend();
    sessionStorage.setItem("plc-ladder-token", clean);
    set({ apiToken: clean, connected: false });
  },

  syncProject: async () => {
    const { apiUrl, apiToken, selectedNetworkId } = get();
    if (!apiUrl) throw new Error("Set server URL first");
    const status = await fetch(`${apiUrl}/api/persistence/status`, { headers: authHeaders(apiToken) });
    if (!status.ok) throw new Error(await readError(status));
    const capability = await status.json() as { configured: boolean };
    if (capability.configured) {
      set({ storageMode: "database", connected: true, pendingChanges: [], history: emptyHistory });
      await durable.refresh();
      if (durable.state.dirty) return; // Sync never discards an unsaved draft.
      const remembered = localStorage.getItem(`plc-ladder-project:${apiUrl}`);
      const selected = durable.state.projects.find(p => p.id === durable.state.projectId || p.id === remembered) ?? durable.state.projects[0];
      if (selected) await durable.select(selected.id);
      else set({ project: { version: "0.2", name: "No project selected", plc: { family: "Mitsubishi FX", model: "FX3U" }, programs: [] }, selectedNetworkId: 0 });
      return;
    }
    if (durable.state.dirty) throw new Error("Database is unavailable; your draft is retained.");
    set({ storageMode: "legacy", projectId: null, revision: null, defaultExportTarget: null });
    try {
      const res = await fetch(`${apiUrl}/api/project`, { headers: authHeaders(apiToken) });
      if (!res.ok) throw new Error(await readError(res));
      const data = await res.json() as LadderProjectV02;
      if (data.version !== "0.2") throw new Error("Server returned unsupported IR version.");
      set({ project: data, selectedNetworkId: pickNetwork(data, selectedNetworkId), connected: true });
    } catch (error) {
      set({ connected: false });
      throw error;
    }
  },

  syncPendingChanges: async () => {
    if (get().storageMode === "database") { set({ pendingChanges: [], loadingChanges: false }); return; }
    const { apiUrl, apiToken } = get();
    if (!apiUrl) return set({ pendingChanges: [], loadingChanges: false });
    set({ loadingChanges: true });
    try {
      const res = await fetch(`${apiUrl}/api/changes`, { headers: authHeaders(apiToken) });
      if (!res.ok) throw new Error(await readError(res));
      set({ pendingChanges: await res.json() as PendingChange[], loadingChanges: false, connected: true });
    } catch (error) {
      set({ loadingChanges: false });
      throw error;
    }
  },

  approvePendingChange: async (id) => {
    if (get().storageMode === "database") throw new Error("Database Human Review integration is not available yet.");
    const { apiUrl, apiToken, selectedNetworkId } = get();
    if (!apiUrl) throw new Error("Set server URL first");
    const res = await fetch(`${apiUrl}/api/changes/approve`, {
      method: "POST",
      headers: authHeaders(apiToken, true),
      body: JSON.stringify({ pending_change_id: id }),
    });
    if (!res.ok) throw new Error(await readError(res));
    const data = await res.json() as { project: LadderProjectV02 };
    set({ project: data.project, selectedNetworkId: pickNetwork(data.project, selectedNetworkId), connected: true });
    await Promise.all([get().syncPendingChanges(), get().syncHistory()]);
  },

  rejectPendingChange: async (id) => {
    if (get().storageMode === "database") throw new Error("Database Human Review integration is not available yet.");
    const { apiUrl, apiToken } = get();
    if (!apiUrl) throw new Error("Set server URL first");
    const res = await fetch(`${apiUrl}/api/changes/reject`, {
      method: "POST",
      headers: authHeaders(apiToken, true),
      body: JSON.stringify({ pending_change_id: id }),
    });
    if (!res.ok) throw new Error(await readError(res));
    await get().syncPendingChanges();
  },

  syncHistory: async () => {
    if (get().storageMode === "database") return;
    const { apiUrl, apiToken } = get();
    if (!apiUrl) return set({ history: emptyHistory, loadingHistory: false });
    set({ loadingHistory: true });
    try {
      const res = await fetch(`${apiUrl}/api/history`, { headers: authHeaders(apiToken) });
      if (!res.ok) throw new Error(await readError(res));
      set({ history: await res.json() as HistoryState, loadingHistory: false, connected: true });
    } catch (error) {
      set({ loadingHistory: false });
      throw error;
    }
  },

  undoProject: async () => {
    if (get().storageMode === "database") { durable.undo(); return; }
    const { apiUrl, apiToken, selectedNetworkId } = get();
    if (!apiUrl) throw new Error("Set server URL first");
    const res = await fetch(`${apiUrl}/api/history/undo`, { method: "POST", headers: authHeaders(apiToken) });
    if (!res.ok) throw new Error(await readError(res));
    const data = await res.json() as HistoryState & { project: LadderProjectV02 };
    const { project, ...history } = data;
    set({ project, history, selectedNetworkId: pickNetwork(project, selectedNetworkId), connected: true });
    await get().syncPendingChanges();
  },

  redoProject: async () => {
    if (get().storageMode === "database") { durable.redo(); return; }
    const { apiUrl, apiToken, selectedNetworkId } = get();
    if (!apiUrl) throw new Error("Set server URL first");
    const res = await fetch(`${apiUrl}/api/history/redo`, { method: "POST", headers: authHeaders(apiToken) });
    if (!res.ok) throw new Error(await readError(res));
    const data = await res.json() as HistoryState & { project: LadderProjectV02 };
    const { project, ...history } = data;
    set({ project, history, selectedNetworkId: pickNetwork(project, selectedNetworkId), connected: true });
    await get().syncPendingChanges();
  },

  syncSavedProjects: async () => {
    if (get().storageMode === "database") { await durable.refresh(); return; }
    const { apiUrl, apiToken } = get();
    if (!apiUrl) return set({ savedProjects: [] });
    const res = await fetch(`${apiUrl}/api/projects`, { headers: authHeaders(apiToken) });
    if (!res.ok) throw new Error(await readError(res));
    set({ savedProjects: await res.json() as SavedProject[] });
  },

  saveProject: async (name) => {
    if (get().storageMode === "database") {
      if (name && name !== get().project.name) durable.edit({ ...get().project, name });
      await durable.flush(); return;
    }
    const { apiUrl, apiToken, project } = get();
    if (!apiUrl) throw new Error("Set server URL first");
    const res = await fetch(`${apiUrl}/api/projects/save`, {
      method: "POST",
      headers: authHeaders(apiToken, true),
      body: JSON.stringify({ name: name || project.name }),
    });
    if (!res.ok) throw new Error(await readError(res));
    await get().syncSavedProjects();
  },

  loadProject: async (name) => {
    if (get().storageMode === "database") { await durable.select(name); return; }
    if (get().switching) throw new Error("Wait for the current project request.");
    set({ switching: true });
    try {
      const { apiUrl, apiToken, selectedNetworkId } = get();
      if (!apiUrl) throw new Error("Set server URL first");
      const res = await fetch(`${apiUrl}/api/projects/load`, {
        method: "POST",
        headers: authHeaders(apiToken, true),
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const data = await res.json() as { project: LadderProjectV02 };
      if (get().apiUrl !== apiUrl || get().apiToken !== apiToken) return;
      set({ pendingChanges: [], history: emptyHistory, project: data.project, selectedNetworkId: pickNetwork(data.project, selectedNetworkId), connected: true });
      await Promise.all([get().syncHistory(), get().syncPendingChanges()]);
    } finally { set({ switching: false }); }
  },

  importGxWorks2: async (content) => {
    if (get().storageMode === "database") { get().setProject(parseGxWorks2ListText(content)); return; }
    if (get().switching) throw new Error("Wait for the current project request.");
    set({ switching: true });
    try {
      const { apiUrl, apiToken } = get();
      if (!apiUrl) throw new Error("Connect to the server before importing GX Works2.");
      const res = await fetch(`${apiUrl}/api/import/gxworks2`, {
        method: "POST",
        headers: authHeaders(apiToken, true),
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const data = await res.json() as { project: LadderProjectV02 };
      if (get().apiUrl !== apiUrl || get().apiToken !== apiToken) return;
      set({ pendingChanges: [], history: emptyHistory, project: data.project, selectedNetworkId: data.project.programs[0]?.networks[0]?.id ?? 0, connected: true });
      await Promise.all([get().syncHistory(), get().syncPendingChanges()]);
    } finally { set({ switching: false }); }
  },
}));

const durable: DurableWorkspace = new DurableWorkspace(projectApi(() => useProjectStore.getState()));
durable.subscribe(state => {
  const current = useProjectStore.getState();
  useProjectStore.setState({ defaultExportTarget: state.defaultExportTarget, projectId: state.projectId, revision: state.revision, dirty: state.dirty,
    switching: state.switching, saveStatus: state.saveStatus, saveError: state.error,
    ...(state.project ? { project: state.project, selectedNetworkId: pickNetwork(state.project, current.selectedNetworkId) } : {}),
    savedProjects: state.projects.map(p => ({ ...p, file: p.id })),
    history: { ...emptyHistory, can_undo: state.undo.length > 0, can_redo: state.redo.length > 0,
      undo_count: state.undo.length, redo_count: state.redo.length },
  });
  if (state.projectId) localStorage.setItem(`plc-ladder-project:${current.apiUrl}`, state.projectId);
});
