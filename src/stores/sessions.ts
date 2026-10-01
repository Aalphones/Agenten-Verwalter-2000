import { create } from 'zustand';

export const SESSION_VIEWS = ['chat', 'changes'] as const;
export type SessionView = (typeof SESSION_VIEWS)[number];

export const PROJECT_VIEWS = ['overview', 'changes'] as const;
export type ProjectView = (typeof PROJECT_VIEWS)[number];

export type RenameKind = 'session' | 'project';

export interface RenameTarget {
  kind: RenameKind;
  id: string;
}

interface SessionsState {
  activeSessionId: string | null;
  activeView: SessionView;
  showNewSession: boolean;
  /** `true`: die Einstellungsseite statt Session, Übersicht oder „Neues Vorhaben“. */
  showSettings: boolean;
  activeProjectId: string | null;
  /** `true`: die Übersicht des Vorhabens `activeProjectId` statt einer Session. */
  showProjectOverview: boolean;
  projectView: ProjectView;
  /** Session oder Vorhaben, dessen Name in der Sidebar gerade bearbeitet wird. */
  renaming: RenameTarget | null;
  /** Vorhaben-ID → aufgeklappt; fehlt ein Eintrag, entscheidet die Sidebar nach ihrem Standard. */
  expanded: Record<string, boolean>;
  selectSession: (sessionId: string) => void;
  selectProject: (projectId: string) => void;
  showView: (view: SessionView) => void;
  showProjectView: (view: ProjectView) => void;
  openNewSession: () => void;
  closeNewSession: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  setExpanded: (projectId: string, value: boolean) => void;
  startRename: (kind: RenameKind, id: string) => void;
  stopRename: () => void;
}

export const useSessionsStore = create<SessionsState>((set) => ({
  activeSessionId: null,
  activeView: 'chat',
  showNewSession: false,
  showSettings: false,
  activeProjectId: null,
  showProjectOverview: false,
  projectView: 'overview',
  renaming: null,
  expanded: {},
  selectSession: (sessionId: string): void => {
    set({
      activeSessionId: sessionId,
      showNewSession: false,
      showSettings: false,
      showProjectOverview: false,
    });
  },
  selectProject: (projectId: string): void => {
    set({
      activeProjectId: projectId,
      showProjectOverview: true,
      projectView: 'overview',
      showNewSession: false,
      showSettings: false,
    });
  },
  showView: (view: SessionView): void => {
    set({ activeView: view });
  },
  showProjectView: (view: ProjectView): void => {
    set({ projectView: view });
  },
  openNewSession: (): void => {
    set({ showNewSession: true, showSettings: false, showProjectOverview: false });
  },
  closeNewSession: (): void => {
    set({ showNewSession: false });
  },
  openSettings: (): void => {
    set({ showSettings: true, showNewSession: false, showProjectOverview: false });
  },
  closeSettings: (): void => {
    set({ showSettings: false });
  },
  setExpanded: (projectId: string, value: boolean): void => {
    set((state: SessionsState) => ({ expanded: { ...state.expanded, [projectId]: value } }));
  },
  startRename: (kind: RenameKind, id: string): void => {
    set({ renaming: { kind, id } });
  },
  stopRename: (): void => {
    set({ renaming: null });
  },
}));
