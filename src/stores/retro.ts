import { create } from 'zustand';

export interface RetroRun {
  done: number;
  /** 0, solange der Core die Zahl der Sessions noch nicht gemeldet hat. */
  total: number;
}

interface RetroState {
  /** Vorhaben-ID → Lauf; fehlt ein Eintrag, läuft keine Retro. */
  running: Record<string, RetroRun>;
  setProgress: (projectId: string, done: number, total: number) => void;
  clear: (projectId: string) => void;
}

export const useRetroStore = create<RetroState>((set) => ({
  running: {},
  setProgress: (projectId: string, done: number, total: number): void => {
    set((state: RetroState) => ({ running: { ...state.running, [projectId]: { done, total } } }));
  },
  clear: (projectId: string): void => {
    set((state: RetroState) => ({
      running: Object.fromEntries(
        Object.entries(state.running).filter(([key]: [string, RetroRun]) => key !== projectId),
      ),
    }));
  },
}));
