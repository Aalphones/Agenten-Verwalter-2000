import { create } from 'zustand';

/** Sprung zu einem Stopp: Phase (Schlüssel) und Nummer des Stopps; die Seite löscht ihn nach dem Anspringen. */
export interface ReportFocus {
  implementationId: string;
  phaseKey: string;
  stopIndex: number;
}

/** Ansicht eines Schaubilds mit Markern: Unterschied (gefärbt), Vorher oder Nachher. */
export const DIAGRAM_MODES = ['diff', 'before', 'after'] as const;
export type DiagramMode = (typeof DIAGRAM_MODES)[number];

interface ReportState {
  /** Umsetzungs-ID → Schlüssel der offenen Phasen-Seite; `null` oder kein Eintrag: der Überblick steht offen. */
  pageByImplementation: Record<string, string | null>;
  /** Umsetzungs-ID → IDs der fertigen Phasen, deren Seite schon offen war (für die Punkte an Reiter und Inhalt). */
  visitedByImplementation: Record<string, readonly string[]>;
  focus: ReportFocus | null;
  /** Schlüssel eines Eintrags (`<Umsetzung>:<Phase>:n<Nr>`) → gewählte Ansicht seines Schaubilds; ohne Eintrag „Unterschied“. */
  diagramModeByEntry: Record<string, DiagramMode>;
  /** Schlüssel eines Bildschirms → Index der gewählten Ansicht; ohne Eintrag die erste. */
  screenViewByEntry: Record<string, number>;
  /** Schlüssel eines Bildschirms → „Entwurf daneben“; ohne Eintrag an. */
  screenCompareByEntry: Record<string, boolean>;
  showPage: (implementationId: string, phaseKey: string | null) => void;
  markVisited: (implementationId: string, phaseId: string) => void;
  jumpToStop: (focus: ReportFocus) => void;
  clearFocus: () => void;
  setDiagramMode: (entryKey: string, mode: DiagramMode) => void;
  setScreenView: (entryKey: string, index: number) => void;
  setScreenCompare: (entryKey: string, isOn: boolean) => void;
}

export const useReportStore = create<ReportState>((set) => ({
  pageByImplementation: {},
  visitedByImplementation: {},
  focus: null,
  diagramModeByEntry: {},
  screenViewByEntry: {},
  screenCompareByEntry: {},
  setDiagramMode: (entryKey: string, mode: DiagramMode): void => {
    set((state: ReportState) => ({
      diagramModeByEntry: { ...state.diagramModeByEntry, [entryKey]: mode },
    }));
  },
  setScreenView: (entryKey: string, index: number): void => {
    set((state: ReportState) => ({
      screenViewByEntry: { ...state.screenViewByEntry, [entryKey]: index },
    }));
  },
  setScreenCompare: (entryKey: string, isOn: boolean): void => {
    set((state: ReportState) => ({
      screenCompareByEntry: { ...state.screenCompareByEntry, [entryKey]: isOn },
    }));
  },
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
