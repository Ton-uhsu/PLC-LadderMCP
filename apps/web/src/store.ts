import { create } from "zustand";
import type { LadderProjectV02 } from "@plc-ladder-mcp/ladder-ir";
import { demoProject } from "./ladder";

const savedApi = localStorage.getItem("plc-ladder-api") ?? "";

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

const emptyHistory: HistoryState = {
  can_undo: false,
  can_redo: false,
  undo_count: 0,
  redo_count: 0,
  entries: [],
};

type State = {
  project: LadderProjectV02;
  apiUrl: string;
  connected: boolean;
  pendingChanges: PendingChange[];
  loadingChanges: boolean;
  history: HistoryState;
  loadingHistory: boolean;
  setProject: (project: LadderProjectV02) => void;
  setApiUrl: (url: string) => void;
  syncProject: () => Promise<void>;
  syncPendingChanges: () => Promise<void>;
  approvePendingChange: (id: string) => Promise<void>;
  rejectPendingChange: (id: string) => Promise<void>;
  syncHistory: () => Promise<void>;
  undoProject: () => Promise<void>;
  redoProject: () => Promise<void>;
};

async function readError(res: Response) {
  try {
    const data = await res.json() as { error?: string };
    return data.error ?? `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

export const useProjectStore = create<State>((set, get) => ({
  project: demoProject,
  apiUrl: savedApi,
  connected: false,
  pendingChanges: [],
  loadingChanges: false,
  history: emptyHistory,
  loadingHistory: false,

  setProject: (project) => set({ project }),

  setApiUrl: (url) => {
    const clean = url.trim().replace(/\/$/, "");
    localStorage.setItem("plc-ladder-api", clean);
    set({
      apiUrl: clean,
      connected: false,
      pendingChanges: [],
      history: emptyHistory,
    });
  },

  syncProject: async () => {
    const { apiUrl } = get();
    if (!apiUrl) throw new Error("Set server URL first");

    try {
      const res = await fetch(`${apiUrl}/api/project`);
      if (!res.ok) throw new Error(await readError(res));
      const data = await res.json() as LadderProjectV02;
      if (data.version !== "0.2") {
        throw new Error(`Server returned unsupported IR version: ${String((data as { version?: unknown }).version)}`);
      }
      set({ project: data, connected: true });
    } catch (error) {
      set({ connected: false });
      throw error;
    }
  },

  syncPendingChanges: async () => {
    const { apiUrl } = get();
    if (!apiUrl) {
      set({ pendingChanges: [], loadingChanges: false });
      return;
    }

    set({ loadingChanges: true });
    try {
      const res = await fetch(`${apiUrl}/api/changes`);
      if (!res.ok) throw new Error(await readError(res));
      const data = await res.json() as PendingChange[];
      set({ pendingChanges: data, loadingChanges: false, connected: true });
    } catch (error) {
      set({ loadingChanges: false });
      throw error;
    }
  },

  approvePendingChange: async (id) => {
    const { apiUrl } = get();
    if (!apiUrl) throw new Error("Set server URL first");

    const res = await fetch(`${apiUrl}/api/changes/approve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pending_change_id: id }),
    });
    if (!res.ok) throw new Error(await readError(res));

    const data = await res.json() as { project: LadderProjectV02 };
    set({ project: data.project, connected: true });
    await Promise.all([get().syncPendingChanges(), get().syncHistory()]);
  },

  rejectPendingChange: async (id) => {
    const { apiUrl } = get();
    if (!apiUrl) throw new Error("Set server URL first");

    const res = await fetch(`${apiUrl}/api/changes/reject`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pending_change_id: id }),
    });
    if (!res.ok) throw new Error(await readError(res));

    await get().syncPendingChanges();
  },

  syncHistory: async () => {
    const { apiUrl } = get();
    if (!apiUrl) {
      set({ history: emptyHistory, loadingHistory: false });
      return;
    }

    set({ loadingHistory: true });
    try {
      const res = await fetch(`${apiUrl}/api/history`);
      if (!res.ok) throw new Error(await readError(res));
      const history = await res.json() as HistoryState;
      set({ history, loadingHistory: false, connected: true });
    } catch (error) {
      set({ loadingHistory: false });
      throw error;
    }
  },

  undoProject: async () => {
    const { apiUrl } = get();
    if (!apiUrl) throw new Error("Set server URL first");
    const res = await fetch(`${apiUrl}/api/history/undo`, { method: "POST" });
    if (!res.ok) throw new Error(await readError(res));
    const data = await res.json() as HistoryState & { project: LadderProjectV02 };
    const { project, ...history } = data;
    set({ project, history, connected: true });
    await get().syncPendingChanges();
  },

  redoProject: async () => {
    const { apiUrl } = get();
    if (!apiUrl) throw new Error("Set server URL first");
    const res = await fetch(`${apiUrl}/api/history/redo`, { method: "POST" });
    if (!res.ok) throw new Error(await readError(res));
    const data = await res.json() as HistoryState & { project: LadderProjectV02 };
    const { project, ...history } = data;
    set({ project, history, connected: true });
    await get().syncPendingChanges();
  },
}));
