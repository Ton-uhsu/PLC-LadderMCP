import { create } from "zustand";
import { demoProject, type LadderProject } from "./ladder";

type State = {
  project: LadderProject;
  setProject: (project: LadderProject) => void;
};

export const useProjectStore = create<State>((set) => ({
  project: demoProject,
  setProject: (project) => set({ project }),
}));
