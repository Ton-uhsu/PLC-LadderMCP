import { create } from "zustand";
import type { LadderProjectV02 } from "@plc-ladder-mcp/ladder-ir";
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

export type SavedProject = { name: string; file: string };

const emptyHistory: HistoryState = {
  can_undo: false,
  can_redo: false,
  undo_count: 0,
  redo_count: 0,
  entries: [],
};

type State = {
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

  setProject: (project) => set(state => ({
    project,
    selectedNetworkId: pickNetwork(project, state.selectedNetworkId),
  })),

  selectNetwork: (id) => set({ selectedNetworkId: id }),

  setApiUrl: (url) => {
    const clean = url.trim().replace(/\/$/, "");
    localStorage.setItem("plc-ladder-api", clean);
    set({ apiUrl: clean, connected: false, pendingChanges: [], history: emptyHistory, savedProjects: [] });
  },

  setApiToken: (token) => {
    const clean = token.trim();
    sessionStorage.setItem("plc-ladder-token", clean);
    set({ apiToken: clean, connected: false });
  },

  syncProject: async () => {
    const { apiUrl, apiToken, selectedNetworkId } = get();
    if (!apiUrl) throw new Error("Set server URL first");
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
    const { apiUrl, apiToken } = get();
    if (!apiUrl) return set({ savedProjects: [] });
    const res = await fetch(`${apiUrl}/api/projects`, { headers: authHeaders(apiToken) });
    if (!res.ok) throw new Error(await readError(res));
    set({ savedProjects: await res.json() as SavedProject[] });
  },

  saveProject: async (name) => {
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
    const { apiUrl, apiToken, selectedNetworkId } = get();
    if (!apiUrl) throw new Error("Set server URL first");
    const res = await fetch(`${apiUrl}/api/projects/load`, {
      method: "POST",
      headers: authHeaders(apiToken, true),
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error(await readError(res));
    const data = await res.json() as { project: LadderProjectV02 };
    set({ project: data.project, selectedNetworkId: pickNetwork(data.project, selectedNetworkId), connected: true });
    await Promise.all([get().syncHistory(), get().syncPendingChanges()]);
  },

  importGxWorks2: async (content) => {
    const { apiUrl, apiToken } = get();
    if (!apiUrl) throw new Error("Connect to the server before importing GX Works2.");
    const res = await fetch(`${apiUrl}/api/import/gxworks2`, {
      method: "POST",
      headers: authHeaders(apiToken, true),
      body: JSON.stringify({ content }),
    });
    if (!res.ok) throw new Error(await readError(res));
    const data = await res.json() as { project: LadderProjectV02 };
    set({ project: data.project, selectedNetworkId: data.project.programs[0]?.networks[0]?.id ?? 0, connected: true });
    await Promise.all([get().syncHistory(), get().syncPendingChanges()]);
  },
}));
