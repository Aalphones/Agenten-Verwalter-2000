import { create } from 'zustand';

export const SESSION_VIEWS = ['chat', 'changes'] as const;
export type SessionView = (typeof SESSION_VIEWS)[number];

interface SessionsState {
  activeSessionId: string | null;
  activeView: SessionView;
  showNewSession: boolean;
  selectSession: (sessionId: string) => void;
  showView: (view: SessionView) => void;
  openNewSession: () => void;
  closeNewSession: () => void;
}

export const useSessionsStore = create<SessionsState>((set) => ({
  activeSessionId: null,
  activeView: 'chat',
  showNewSession: false,
  selectSession: (sessionId: string): void => {
    set({ activeSessionId: sessionId, showNewSession: false });
  },
  showView: (view: SessionView): void => {
    set({ activeView: view });
  },
  openNewSession: (): void => {
    set({ showNewSession: true });
  },
  closeNewSession: (): void => {
    set({ showNewSession: false });
  },
}));
