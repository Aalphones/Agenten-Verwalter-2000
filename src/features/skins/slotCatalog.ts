export const BUILTIN_SLOT_IDS = [
  'search',
  'read',
  'write',
  'shell',
  'longrun',
  'web',
  'agent',
  'other',
  'wait',
  'think',
  'commit',
  'station',
] as const;

export type BuiltinSlotId = (typeof BUILTIN_SLOT_IDS)[number];

/** Das Fach, das statt „Befehl“ gilt, sobald ein Shell-Befehl lange läuft. */
export const LONGRUN_SLOT: BuiltinSlotId = 'longrun';

/** Werkzeugname → Fach; jedes Werkzeug ohne Eintrag gehört ins Fach „Sonstiges“. */
export const BUILTIN_TOOL_SLOTS: Readonly<Record<string, BuiltinSlotId>> = {
  Grep: 'search',
  Glob: 'search',
  Read: 'read',
  Edit: 'write',
  Write: 'write',
  NotebookEdit: 'write',
  Bash: 'shell',
  PowerShell: 'shell',
  WebSearch: 'web',
  WebFetch: 'web',
  Agent: 'agent',
  Task: 'agent',
};

/** Sachliche Texte der Fächer; `{ziel}`, `{befehl}`, `{zeit}`, `{commit}`, `{fortschritt}` und `{rest}` füllt `fillText`. */
export const PLAIN_TEXTS: Readonly<Record<BuiltinSlotId, string>> = {
  search: 'Durchsucht {ziel} …',
  read: 'Liest {ziel} …',
  write: 'Bearbeitet {ziel} …',
  shell: '{ziel} …',
  longrun: '{ziel} …',
  web: 'Sucht im Web nach {ziel} …',
  agent: 'Unteragent: {ziel} …',
  other: 'Arbeitet mit {ziel} …',
  wait: 'Wartet auf {ziel} …',
  think: 'Denkt nach …',
  commit: 'Commit {commit} erstellt.',
  station: 'Station fertig.',
};

export const SLOT_LABELS: Readonly<Record<BuiltinSlotId, string>> = {
  search: 'Suchen',
  read: 'Lesen',
  write: 'Schreiben',
  shell: 'Befehl',
  longrun: 'Langer Lauf',
  web: 'Web',
  agent: 'Unteragent',
  other: 'Sonstiges',
  wait: 'Warten',
  think: 'Denken',
  commit: 'Commit',
  station: 'Station fertig',
};

/** Text, solange noch kein Fach feststeht (erste Sekunde der Arbeit, Pause zwischen Werkzeugen). */
export const IDLE_TEXT = 'Arbeitet …';
