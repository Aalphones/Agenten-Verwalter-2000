import { create } from 'zustand';

interface SessionErrorsState {
  /** Letzter Aktionsfehler je Session-ID. */
  errors: Record<string, string>;
  report: (sessionId: string, message: string) => void;
  clear: (sessionId: string) => void;
}

export const useSessionErrorsStore = create<SessionErrorsState>((set) => ({
  errors: {},
  report: (sessionId: string, message: string): void => {
    set((state: SessionErrorsState) => ({ errors: { ...state.errors, [sessionId]: message } }));
  },
  clear: (sessionId: string): void => {
    set((state: SessionErrorsState) => {
      if (!(sessionId in state.errors)) {
        return state;
      }
      const remaining: Record<string, string> = Object.fromEntries(
        Object.entries(state.errors).filter(([key]: [string, string]) => key !== sessionId),
      );
      return { errors: remaining };
    });
  },
}));
