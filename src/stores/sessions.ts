import { create } from 'zustand';

interface SessionsState {
  activeSessionId: string | null;
  showNewSession: boolean;
  selectSession: (sessionId: string) => void;
  openNewSession: () => void;
  closeNewSession: () => void;
}

export const useSessionsStore = create<SessionsState>((set) => ({
  activeSessionId: null,
  showNewSession: false,
  selectSession: (sessionId: string): void => {
    set({ activeSessionId: sessionId, showNewSession: false });
  },
  openNewSession: (): void => {
    set({ showNewSession: true });
  },
  closeNewSession: (): void => {
    set({ showNewSession: false });
  },
}));
