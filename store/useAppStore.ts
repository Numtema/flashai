import { create } from "zustand";
import { produce } from "immer";
import { persist } from "zustand/middleware";
import { AppState } from "../types";

type RootState = {
  data: AppState;
  route: { params: Record<string, string> };
  
  // Basic Path Ops
  setPath: (path: string, value: any) => void;
  pushPath: (path: string, value: any) => void;
  getPath: (path: string) => any;
  setRouteParams: (params: Record<string, string>) => void;
  
  // Domain Specific Ops
  applyArtifactPatch: (artifactId: string, patch: any) => void;
  getSelectedArtifact: () => any;
};

// Helper: Deep Get
const getByPath = (obj: any, path: string) => {
  if (!path) return undefined;
  const parts = path.split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
};

// Helper: Deep Set
const setByPath = (obj: any, path: string, value: any) => {
  const parts = path.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    cur[parts[i]] ??= {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
};

export const useAppStore = create<RootState>()(
  persist(
    (set, get) => ({
      data: { workspace: { artifacts: [] } } as any,
      route: { params: {} },

      setRouteParams: (params) => set({ route: { params } }),

      getPath: (path) => getByPath(get().data, path),

      setPath: (path, value) =>
        set(
          produce((state: RootState) => {
            setByPath(state.data, path, value);
          })
        ),

      pushPath: (path, value) =>
        set(
          produce((state: RootState) => {
            const arr = getByPath(state.data, path);
            if (Array.isArray(arr)) arr.push(value);
            else setByPath(state.data, path, [value]);
          })
        ),

      applyArtifactPatch: (artifactId, patch) =>
        set(
          produce((state: RootState) => {
            const artifacts = state.data.workspace?.artifacts || [];
            const idx = artifacts.findIndex((a: any) => a.id === artifactId);
            if (idx < 0) return;

            // "patch" can be a single operation or array of ops
            const patches = Array.isArray(patch) ? patch : [patch];

            for (const p of patches) {
              if (p.op === "set") {
                // Apply deeply to the artifact.data
                // e.g., path: "data.email" -> state.workspace.artifacts[i].data.email
                const fullPath = `workspace.artifacts.${idx}.${p.path}`;
                setByPath(state.data, fullPath, p.value);
              }
              // Can add 'merge', 'delete' ops here
            }
          })
        ),

      getSelectedArtifact: () => {
        const st = get();
        const id = st.getPath("workspace.selectedArtifactId");
        const arts = st.getPath("workspace.artifacts") || [];
        return arts.find((a: any) => a.id === id);
      },
    }),
    {
      name: "flash-builder-storage", // unique name for local storage
      partialize: (state) => ({ data: state.data }), // only persist the 'data' part, not route or transient
    }
  )
);