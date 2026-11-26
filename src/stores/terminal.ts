import { create } from 'zustand';

/** Markiert in `selected` den Notiz-Reiter statt eines Terminals (ADR 074). */
export const NOTE_TAB_ID = 'note';

interface TerminalState {
  isOpen: boolean;
  isMaximized: boolean;
  /** Größe in Pixeln, solange die Ziehkante gehalten wird; sonst `null`. */
  dragSize: number | null;
  /** Gewähltes Terminal je Vorhaben (Vorhaben-ID → Terminal-ID). */
  selected: Record<string, string>;
  /** Vorhaben, deren Notiz-Reiter ausgeblendet ist; nur im Speicher, die Datei bleibt. */
  noteHidden: Record<string, boolean>;
  toggle: () => void;
  close: () => void;
  setDragSize: (size: number | null) => void;
  toggleMaximized: () => void;
  select: (projectId: string, terminalId: string) => void;
  hideNote: (projectId: string) => void;
  showNote: (projectId: string) => void;
}

export const useTerminalStore = create<TerminalState>((set) => ({
  isOpen: false,
  isMaximized: false,
  dragSize: null,
  selected: {},
  noteHidden: {},
  toggle: (): void => {
    set((state: TerminalState) => ({
      isOpen: !state.isOpen,
      isMaximized: state.isOpen ? false : state.isMaximized,
    }));
  },
  close: (): void => {
    set({ isOpen: false, isMaximized: false });
  },
  setDragSize: (size: number | null): void => {
    set({ dragSize: size });
  },
  toggleMaximized: (): void => {
    set((state: TerminalState) => ({ isMaximized: !state.isMaximized }));
  },
  select: (projectId: string, terminalId: string): void => {
    set((state: TerminalState) => ({ selected: { ...state.selected, [projectId]: terminalId } }));
  },
  hideNote: (projectId: string): void => {
    set((state: TerminalState) => {
      const { [projectId]: current, ...otherSelected } = state.selected;
      return {
        noteHidden: { ...state.noteHidden, [projectId]: true },
        selected: current === NOTE_TAB_ID ? otherSelected : state.selected,
      };
    });
  },
  showNote: (projectId: string): void => {
    set((state: TerminalState) => ({
      noteHidden: { ...state.noteHidden, [projectId]: false },
      selected: { ...state.selected, [projectId]: NOTE_TAB_ID },
    }));
  },
}));
