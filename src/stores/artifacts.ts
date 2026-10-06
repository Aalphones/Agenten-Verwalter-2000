import { create } from 'zustand';

interface ArtifactsState {
  /** Vorhaben-ID → Dateiname des gewählten Artefakts; fehlt der Eintrag, gilt das neueste. */
  selected: Record<string, string>;
  select: (projectId: string, file: string) => void;
}

export const useArtifactsStore = create<ArtifactsState>((set) => ({
  selected: {},
  select: (projectId: string, file: string): void => {
    set((state: ArtifactsState) => ({ selected: { ...state.selected, [projectId]: file } }));
  },
}));
