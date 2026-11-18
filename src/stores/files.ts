import { create } from 'zustand';
import type { ChangeScope } from '@/lib/bindings/ChangeScope';

/** „Geändert“ zeigt nur geänderte Dateien, „Alle Dateien“ den ganzen Ordner des Repositorys. */
export type FilesMode = 'changed' | 'all';

/** Rechte Seite ohne offene Datei: die Übersicht oder die Git-Seite eines Repositorys. */
export type FilesPage = 'overview' | { git: string };

/** Schmale Breite: welche Seite gerade die ganze Breite hat. */
export type FilesPane = 'tree' | 'detail';

export interface OpenTarget {
  /** `group` des Repository-Knotens. */
  group: string;
  /** Eintrag, aus dem die Datei geöffnet wurde (Fassung oder Commit). */
  entryKey: string;
  path: string;
  /** `null`: die Ansicht wählt selbst (geändert → Änderung, sonst ganze Datei). */
  view: 'diff' | 'file' | null;
  /** ID eines Schritts oder `'all'` für das ganze Vorhaben. */
  step: string;
  line: number | null;
}

/** Ein Dateilink aus dem Chat, den `FilesView` auflöst, sobald Changes und Bäume geladen sind. */
export type PendingLink =
  { kind: 'view'; key: string; path: string; line: number | null } | { kind: 'name'; name: string };

/** Aufgeklappte Ordner je Modus als `<Gruppe>:<Ordnerpfad>`, der Knoten selbst als `<Gruppe>:`; `null`: noch
 *  nichts angefasst, es gilt die Vorgabe (in „Geändert“ die ersten zwei Ordnerebenen, in „Alle Dateien“ nur die
 *  Knoten). */
export interface FilesExpanded {
  changed: readonly string[] | null;
  all: readonly string[] | null;
}

export interface FilesSelection {
  mode: FilesMode;
  scope: ChangeScope;
  /** ID der gefilterten Session; `null`: das ganze Vorhaben. */
  sessionFilter: string | null;
  open: OpenTarget | null;
  page: FilesPage;
  pane: FilesPane;
  expanded: FilesExpanded;
  /** Aufgeklappte Commits im Verlauf als `<Eintrag>|<Commit-ID>`. */
  openCommits: readonly string[];
  /** Bildlaufposition der Übersicht in Pixeln. */
  overviewTop: number;
  /** Suchtext der Dateisuche; bleibt, bis eine Datei gewählt wird. */
  query: string;
  /** Wird von Strg P hochgezählt; die Suche setzt den Fokus, sobald er von `focusDone` abweicht. */
  focusSearch: number;
  /** Der Stand von `focusSearch`, den die Suche schon bedient hat. */
  focusDone: number;
  /** Dateilink aus dem Chat, der noch nicht geöffnet ist. */
  pendingLink: PendingLink | null;
}

export const DEFAULT_FILES_SELECTION: FilesSelection = {
  mode: 'changed',
  scope: 'all',
  sessionFilter: null,
  open: null,
  page: 'overview',
  pane: 'tree',
  expanded: { changed: null, all: null },
  openCommits: [],
  overviewTop: 0,
  query: '',
  focusSearch: 0,
  focusDone: 0,
  pendingLink: null,
};

interface FilesState {
  /** Schlüssel der Ansicht (Session, Übersicht des Vorhabens, Umsetzung) → Auswahl; nur solange die App läuft. */
  selections: Record<string, FilesSelection>;
  update: (viewKey: string, change: Partial<FilesSelection>) => void;
}

export const useFilesStore = create<FilesState>((set) => ({
  selections: {},
  update: (viewKey: string, change: Partial<FilesSelection>): void => {
    set((state: FilesState) => ({
      selections: {
        ...state.selections,
        [viewKey]: { ...DEFAULT_FILES_SELECTION, ...state.selections[viewKey], ...change },
      },
    }));
  },
}));
