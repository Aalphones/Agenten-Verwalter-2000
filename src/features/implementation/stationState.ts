import type { DisplayStatus } from '@/features/sessions/sessionStatus';
import type { StationState } from '@/lib/bindings/StationState';
import type { SessionSummary } from '@/lib/bindings/SessionSummary';
import type { StationView } from '@/lib/bindings/StationView';

const LABEL: Record<StationState, string> = {
  pending: 'wartet',
  ready: 'bereit',
  countdown: 'startet gleich',
  starting: 'startet',
  running: 'läuft',
  waitsForScript: 'wartet auf Skript',
  waitsForLimit: 'wartet aufs Kontingent',
  asking: 'fragt dich',
  waitsForYou: 'wartet auf dich',
  done: 'fertig',
  error: 'Fehler',
};

/** Symbol der Sessions, damit Umsetzung und Session-Zeilen gleich aussehen. */
const ICON: Record<StationState, DisplayStatus> = {
  pending: 'new',
  ready: 'new',
  countdown: 'handoff',
  starting: 'starting',
  running: 'running',
  waitsForScript: 'script',
  waitsForLimit: 'script',
  asking: 'waiting',
  waitsForYou: 'waiting',
  done: 'completed',
  error: 'error',
};

/** Farbfamilie eines Zustands für Punkt, Linie und Kartenrand. */
export type StationTone = 'done' | 'run' | 'wait' | 'error' | 'todo';

const TONE: Record<StationState, StationTone> = {
  pending: 'todo',
  ready: 'todo',
  countdown: 'todo',
  starting: 'run',
  running: 'run',
  waitsForScript: 'run',
  waitsForLimit: 'run',
  asking: 'wait',
  waitsForYou: 'wait',
  done: 'done',
  error: 'error',
};

/** Rang für die Fokus-Automatik; kleiner = dringender (wie `urgency` im Core). */
const URGENCY_RANK: Record<StationState, number> = {
  asking: 0,
  waitsForYou: 1,
  error: 2,
  countdown: 3,
  running: 4,
  starting: 4,
  waitsForScript: 4,
  waitsForLimit: 4,
  ready: 5,
  pending: 6,
  done: 7,
};

export function stateTone(state: StationState): StationTone {
  return TONE[state];
}

export function urgencyRank(state: StationState): number {
  return URGENCY_RANK[state];
}

export function stateLabel(state: StationState): string {
  return LABEL[state];
}

export function stateIcon(state: StationState): DisplayStatus {
  return ICON[state];
}

/** Die laufende Session weicht in Modell oder Aufwand vom Plan der Station ab; ein leerer Plan-Wert zählt nie als Abweichung. */
export function deviatesFromPlan(station: StationView, session: SessionSummary | null): boolean {
  if (session === null) {
    return false;
  }
  return (
    (station.model !== null && station.model !== session.model) ||
    (station.effort !== null && station.effort !== session.effort)
  );
}
