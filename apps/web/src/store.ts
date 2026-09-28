import { create } from "zustand";
import { demoProject, type LadderProject } from "./ladder";

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
      set({ project: await res.json(), connected: true });
    } catch (e) {
      set({ connected: false });
      throw e;
    }
  },
}));
