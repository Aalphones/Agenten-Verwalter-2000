import type { BackgroundItem } from '@/lib/bindings/BackgroundItem';

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

/** Dauer der beendeten Vordergrund-Befehle in Millisekunden nach `toolUseId`; eigene Zuordnung, weil `indexByToolUseId`
 *  Befehle bewusst nicht enthält (sonst löste sich jeder Befehl aus seiner Gruppe im Verlauf). */
export function commandDurations(items: readonly BackgroundItem[]): ReadonlyMap<string, number> {
  const durations = new Map<string, number>();
  for (const item of items) {
    if (item.kind === 'command' && item.endedAt !== null) {
      durations.set(item.toolUseId, Math.max(0, item.endedAt - item.startedAt));
    }
  }
  return durations;
}
