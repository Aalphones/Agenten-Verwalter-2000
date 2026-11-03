import type { DisplayStatus } from '@/features/sessions/sessionStatus';
import type { StationState } from '@/lib/bindings/StationState';

const LABEL: Record<StationState, string> = {
  pending: 'wartet',
  ready: 'bereit',
  countdown: 'startet gleich',
  starting: 'startet',
  running: 'läuft',
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
  asking: 'waiting',
  waitsForYou: 'waiting',
  done: 'completed',
  error: 'error',
};

export function stateLabel(state: StationState): string {
  return LABEL[state];
}

export function stateIcon(state: StationState): DisplayStatus {
  return ICON[state];
}
