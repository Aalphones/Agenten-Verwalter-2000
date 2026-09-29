import { create } from 'zustand';

export const SESSION_VIEWS = ['chat', 'changes'] as const;
export type SessionView = (typeof SESSION_VIEWS)[number];

interface SessionsState {
  activeSessionId: string | null;
  activeView: SessionView;
  showNewSession: boolean;
  /** Session, deren Name in der Sidebar gerade bearbeitet wird. */
  renamingId: string | null;
  selectSession: (sessionId: string) => void;
  showView: (view: SessionView) => void;
  openNewSession: () => void;
  closeNewSession: () => void;
  startRename: (sessionId: string) => void;
  stopRename: () => void;
}

export const useSessionsStore = create<SessionsState>((set) => ({
  activeSessionId: null,
  activeView: 'chat',
  showNewSession: false,
  renamingId: null,
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
  startRename: (sessionId: string): void => {
    set({ renamingId: sessionId });
  },
  stopRename: (): void => {
    set({ renamingId: null });
  },
}));
