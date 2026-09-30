import { create } from 'zustand';

interface TldrState {
  /** Session-ID → TL;DR-Karte eingeklappt; fehlt ein Eintrag, ist sie aufgeklappt. */
  collapsed: Record<string, boolean>;
  toggleCollapsed: (sessionId: string) => void;
}

export const useTldrStore = create<TldrState>((set) => ({
  collapsed: {},
  toggleCollapsed: (sessionId: string): void => {
    set((state: TldrState) => ({
      collapsed: { ...state.collapsed, [sessionId]: !state.collapsed[sessionId] },
    }));
  },
}));
