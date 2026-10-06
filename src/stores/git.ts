import { create } from 'zustand';

/** Flüchtiger Zustand der Git-Bedienung einer Session; alle Maps sind nach dem `key` des Eintrags geordnet. */
export interface GitSessionUi {
  /** Entwurf der Commit-Nachricht. */
  messages: Record<string, string>;
  /** Nur Abweichungen vom Standard (eigene Dateien an, fremde aus), je Pfad. */
  checked: Record<string, Record<string, boolean>>;
  showForeign: Record<string, boolean>;
  collapsed: Record<string, boolean>;
}

const EMPTY_UI: GitSessionUi = { messages: {}, checked: {}, showForeign: {}, collapsed: {} };

interface GitState {
  sessions: Record<string, GitSessionUi>;
  setMessage: (sessionId: string, entryKey: string, message: string) => void;
  /** `isOwn` bestimmt den Standard: eigene Dateien sind angehakt, fremde nicht. */
  setChecked: (
    sessionId: string,
    entryKey: string,
    path: string,
    value: boolean,
    isOwn: boolean,
  ) => void;
  setAllOwn: (
    sessionId: string,
    entryKey: string,
    paths: readonly string[],
    value: boolean,
  ) => void;
  toggleForeign: (sessionId: string, entryKey: string) => void;
  toggleCollapsed: (sessionId: string, entryKey: string) => void;
  /** Nach einem Commit: Nachricht und Abweichungen des Eintrags verwerfen. */
  clearEntry: (sessionId: string, entryKey: string) => void;
}

function withUi(
  sessions: Record<string, GitSessionUi>,
  sessionId: string,
  change: (ui: GitSessionUi) => GitSessionUi,
): Record<string, GitSessionUi> {
  return { ...sessions, [sessionId]: change(sessions[sessionId] ?? EMPTY_UI) };
}

function withoutKey<Value>(record: Record<string, Value>, key: string): Record<string, Value> {
  return Object.fromEntries(
    Object.entries(record).filter(([candidate]: [string, Value]) => candidate !== key),
  );
}

export const useGitStore = create<GitState>((set) => ({
  sessions: {},
  setMessage: (sessionId: string, entryKey: string, message: string): void => {
    set((state: GitState) => ({
      sessions: withUi(state.sessions, sessionId, (ui: GitSessionUi) => ({
        ...ui,
        messages: { ...ui.messages, [entryKey]: message },
      })),
    }));
  },
  setChecked: (
    sessionId: string,
    entryKey: string,
    path: string,
    value: boolean,
    isOwn: boolean,
  ): void => {
    set((state: GitState) => ({
      sessions: withUi(state.sessions, sessionId, (ui: GitSessionUi) => {
        const deviations: Record<string, boolean> = ui.checked[entryKey] ?? {};
        const next: Record<string, boolean> =
          value === isOwn ? withoutKey(deviations, path) : { ...deviations, [path]: value };
        return { ...ui, checked: { ...ui.checked, [entryKey]: next } };
      }),
    }));
  },
  setAllOwn: (
    sessionId: string,
    entryKey: string,
    paths: readonly string[],
    value: boolean,
  ): void => {
    set((state: GitState) => ({
      sessions: withUi(state.sessions, sessionId, (ui: GitSessionUi) => {
        const touched: ReadonlySet<string> = new Set(paths);
        const kept: Record<string, boolean> = Object.fromEntries(
          Object.entries(ui.checked[entryKey] ?? {}).filter(
            ([path]: [string, boolean]) => !touched.has(path),
          ),
        );
        // Eigene Dateien sind standardmäßig an: „alle“ löscht die Abweichungen, „keine“ setzt sie.
        const next: Record<string, boolean> = value
          ? kept
          : { ...kept, ...Object.fromEntries(paths.map((path: string) => [path, false])) };
        return { ...ui, checked: { ...ui.checked, [entryKey]: next } };
      }),
    }));
  },
  toggleForeign: (sessionId: string, entryKey: string): void => {
    set((state: GitState) => ({
      sessions: withUi(state.sessions, sessionId, (ui: GitSessionUi) => ({
        ...ui,
        showForeign: { ...ui.showForeign, [entryKey]: !(ui.showForeign[entryKey] ?? false) },
      })),
    }));
  },
  toggleCollapsed: (sessionId: string, entryKey: string): void => {
    set((state: GitState) => ({
      sessions: withUi(state.sessions, sessionId, (ui: GitSessionUi) => ({
        ...ui,
        collapsed: { ...ui.collapsed, [entryKey]: !(ui.collapsed[entryKey] ?? false) },
      })),
    }));
  },
  clearEntry: (sessionId: string, entryKey: string): void => {
    set((state: GitState) => ({
      sessions: withUi(state.sessions, sessionId, (ui: GitSessionUi) => ({
        ...ui,
        messages: withoutKey(ui.messages, entryKey),
        checked: withoutKey(ui.checked, entryKey),
      })),
    }));
  },
}));

export function isPathChecked(
  ui: GitSessionUi | undefined,
  entryKey: string,
  path: string,
  isOwn: boolean,
): boolean {
  return ui?.checked[entryKey]?.[path] ?? isOwn;
}

/** Die angehakten Pfade eines Eintrags im Moment des Aufrufs (für Aktionen, nicht fürs Rendern). */
export function checkedPaths(
  sessionId: string,
  entryKey: string,
  ownPaths: readonly string[],
  foreignPaths: readonly string[],
): string[] {
  const ui: GitSessionUi | undefined = useGitStore.getState().sessions[sessionId];
  return [
    ...ownPaths.filter((path: string) => isPathChecked(ui, entryKey, path, true)),
    ...foreignPaths.filter((path: string) => isPathChecked(ui, entryKey, path, false)),
  ];
}
