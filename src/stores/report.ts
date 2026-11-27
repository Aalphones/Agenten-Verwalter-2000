import { create } from 'zustand';

/** Sprung zu einem Stopp: Phase (Schlüssel) und Nummer des Stopps; die Seite löscht ihn nach dem Anspringen. */
export interface ReportFocus {
  implementationId: string;
  phaseKey: string;
  stopIndex: number;
}

interface ReportState {
  /** Umsetzungs-ID → Schlüssel der offenen Phasen-Seite; `null` oder kein Eintrag: der Überblick steht offen. */
  pageByImplementation: Record<string, string | null>;
  /** Umsetzungs-ID → IDs der fertigen Phasen, deren Seite schon offen war (für die Punkte an Reiter und Inhalt). */
  visitedByImplementation: Record<string, readonly string[]>;
  focus: ReportFocus | null;
  showPage: (implementationId: string, phaseKey: string | null) => void;
  markVisited: (implementationId: string, phaseId: string) => void;
  jumpToStop: (focus: ReportFocus) => void;
  clearFocus: () => void;
}

export const useReportStore = create<ReportState>((set) => ({
  pageByImplementation: {},
  visitedByImplementation: {},
  focus: null,
  showPage: (implementationId: string, phaseKey: string | null): void => {
    set((state: ReportState) => ({
      pageByImplementation: { ...state.pageByImplementation, [implementationId]: phaseKey },
      focus: null,
    }));
  },
  markVisited: (implementationId: string, phaseId: string): void => {
    set((state: ReportState) => {
      const visited: readonly string[] = state.visitedByImplementation[implementationId] ?? [];
      if (visited.includes(phaseId)) {
        return state;
      }
      return {
        visitedByImplementation: {
          ...state.visitedByImplementation,
          [implementationId]: [...visited, phaseId],
        },
      };
    });
  },
  jumpToStop: (focus: ReportFocus): void => {
    set((state: ReportState) => ({
      pageByImplementation: {
        ...state.pageByImplementation,
        [focus.implementationId]: focus.phaseKey,
      },
      focus,
    }));
  },
  clearFocus: (): void => {
    set({ focus: null });
  },
}));
