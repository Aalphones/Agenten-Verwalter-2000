import type { BackgroundItem } from '@/lib/bindings/BackgroundItem';

export interface ProcessGroups {
  running: BackgroundItem[];
  executed: BackgroundItem[];
}

/** Gruppen des Reiters „Prozesse“. Schiebt die Kommandozeile einen Vordergrund-Befehl selbst in den Hintergrund,
 *  gibt es ihn zweimal (als `command` und als `process`, gleiche `toolUseId`) — dann zählt nur der `process`.
 *  „Ausgeführt“ zeigt das Neueste zuoberst, damit es in der begrenzten Liste nicht unten wegscrollt. */
export function splitProcesses(items: readonly BackgroundItem[]): ProcessGroups {
  const processToolIds = new Set<string>(
    items
      .filter((item: BackgroundItem) => item.kind === 'process')
      .map((item: BackgroundItem) => item.toolUseId),
  );
  const visible: BackgroundItem[] = items.filter(
    (item: BackgroundItem) =>
      item.kind === 'process' || (item.kind === 'command' && !processToolIds.has(item.toolUseId)),
  );
  return {
    running: visible.filter((item: BackgroundItem) => item.state === 'running'),
    executed: visible
      .filter((item: BackgroundItem) => item.state !== 'running')
      .sort((first: BackgroundItem, second: BackgroundItem) => second.startedAt - first.startedAt),
  };
}

export function selectSubagents(items: readonly BackgroundItem[]): BackgroundItem[] {
  return items.filter((item: BackgroundItem) => item.kind === 'subagent');
}

/** Laufende Prozesse und Subagenten — die Zahl im Knopf der Kopfzeile. */
export function countRunning(items: readonly BackgroundItem[]): number {
  return items.filter(
    (item: BackgroundItem) =>
      item.state === 'running' && (item.kind === 'process' || item.kind === 'subagent'),
  ).length;
}

/** Prozesse und Subagenten nach `toolUseId`: so findet die Zeile im Verlauf ihren Eintrag. */
export function indexByToolUseId(
  items: readonly BackgroundItem[],
): ReadonlyMap<string, BackgroundItem> {
  const index = new Map<string, BackgroundItem>();
  for (const item of items) {
    if (item.kind === 'process' || item.kind === 'subagent') {
      index.set(item.toolUseId, item);
    }
  }
  return index;
}

/** Der gewählte Eintrag; ohne Wahl oder bei einem verschwundenen Eintrag der erste. */
export function pickSelected(
  items: readonly BackgroundItem[],
  selectedId: string | null,
): BackgroundItem | null {
  return items.find((item: BackgroundItem) => item.id === selectedId) ?? items[0] ?? null;
}
