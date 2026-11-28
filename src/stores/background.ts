import { create } from 'zustand';

interface BackgroundState {
  isOpen: boolean;
  /** Gewählte Nebenfrage je Session. */
  selections: Record<string, string>;
  toggle: () => void;
  close: () => void;
  select: (sessionId: string, id: string) => void;
}

export const useBackgroundStore = create<BackgroundState>((set) => ({
  isOpen: false,
  selections: {},
  toggle: (): void => {
    set((state: BackgroundState) => ({ isOpen: !state.isOpen }));
  },
  close: (): void => {
    set({ isOpen: false });
  },
  select: (sessionId: string, id: string): void => {
    set((state: BackgroundState) => ({
      selections: { ...state.selections, [sessionId]: id },
    }));
  },
}));
