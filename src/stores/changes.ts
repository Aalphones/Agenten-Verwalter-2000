import { create } from 'zustand';
import type { ChangeScope } from '@/lib/bindings/ChangeScope';

export interface OpenFile {
  position: number;
  path: string;
}

export interface ChangesSelection {
  /** `position` des gewählten Repositorys; `null` zeigt alle. */
  repositoryFilter: number | null;
  scope: ChangeScope;
  openFile: OpenFile | null;
}

export const DEFAULT_SELECTION: ChangesSelection = {
  repositoryFilter: null,
  scope: 'all',
  openFile: null,
};

interface ChangesState {
  selections: Record<string, ChangesSelection>;
  setRepositoryFilter: (sessionId: string, position: number | null) => void;
  setScope: (sessionId: string, scope: ChangeScope) => void;
  openFile: (sessionId: string, file: OpenFile) => void;
  closeFile: (sessionId: string) => void;
}

function withSelection(
  selections: Record<string, ChangesSelection>,
  sessionId: string,
  change: Partial<ChangesSelection>,
): Record<string, ChangesSelection> {
  return {
    ...selections,
    [sessionId]: { ...DEFAULT_SELECTION, ...selections[sessionId], ...change },
  };
}

export const useChangesStore = create<ChangesState>((set) => ({
  selections: {},
  setRepositoryFilter: (sessionId: string, position: number | null): void => {
    set((state: ChangesState) => ({
      selections: withSelection(state.selections, sessionId, { repositoryFilter: position }),
    }));
  },
  setScope: (sessionId: string, scope: ChangeScope): void => {
    set((state: ChangesState) => ({
      selections: withSelection(state.selections, sessionId, { scope }),
    }));
  },
  openFile: (sessionId: string, file: OpenFile): void => {
    set((state: ChangesState) => ({
      selections: withSelection(state.selections, sessionId, { openFile: file }),
    }));
  },
  closeFile: (sessionId: string): void => {
    set((state: ChangesState) => ({
      selections: withSelection(state.selections, sessionId, { openFile: null }),
    }));
  },
}));
