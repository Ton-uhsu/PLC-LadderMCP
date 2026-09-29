import { create } from "zustand";
import type { LadderProjectV02 } from "@plc-ladder-mcp/ladder-ir";
import { demoProject } from "./ladder";

const savedApi = localStorage.getItem("plc-ladder-api") ?? "";

type State = {
  project: LadderProjectV02;
  apiUrl: string;
  connected: boolean;
  setProject: (project: LadderProjectV02) => void;
  setApiUrl: (url: string) => void;
  syncProject: () => Promise<void>;
};

export const useProjectStore = create<State>((set, get) => ({
  project: demoProject,
  apiUrl: savedApi,
  connected: false,
  setProject: (project) => set({ project }),
  setApiUrl: (url) => {
    const clean = url.trim().replace(/\/$/, "");
    localStorage.setItem("plc-ladder-api", clean);
    set({ apiUrl: clean, connected: false });
  },
  syncProject: async () => {
    const { apiUrl } = get();
    if (!apiUrl) throw new Error("Set server URL first");

    try {
      const res = await fetch(`${apiUrl}/api/project`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as LadderProjectV02;
      if (data.version !== "0.2") throw new Error(`Server returned unsupported IR version: ${String((data as { version?: unknown }).version)}`);
      set({ project: data, connected: true });
    } catch (error) {
      set({ connected: false });
      throw error;
    }
  },
}));
