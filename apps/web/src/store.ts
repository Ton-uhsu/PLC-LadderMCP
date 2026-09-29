import { create } from "zustand";
import { demoProject, type LadderProject } from "./ladder";
import type { LadderProjectV02 } from "@plc-ladder-mcp/ladder-ir";
import { v02ProjectToLegacy } from "./ir-v02-bridge";

const savedApi = localStorage.getItem("plc-ladder-api") ?? "";

type State = {
  project: LadderProject;
  apiUrl: string;
  connected: boolean;
  setProject: (project: LadderProject) => void;
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
      const data = await res.json() as LadderProject | LadderProjectV02;
      set({ project: data.version === "0.2" ? v02ProjectToLegacy(data) : data, connected: true });
    } catch (e) {
      set({ connected: false });
      throw e;
    }
  },
}));
