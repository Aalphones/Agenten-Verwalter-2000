import type { BackgroundState } from '@/lib/bindings/BackgroundState';

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;

const STATE_LABEL: Record<BackgroundState, string> = {
  running: 'läuft',
  completed: 'fertig',
  failed: 'fehlgeschlagen',
  stopped: 'angehalten',
  interrupted: 'unterbrochen',
};

export function stateLabel(state: BackgroundState): string {
  return STATE_LABEL[state];
}

export type StateTone = 'running' | 'completed' | 'error' | 'paused';

const STATE_TONE: Record<BackgroundState, StateTone> = {
  running: 'running',
  completed: 'completed',
  failed: 'error',
  stopped: 'paused',
  interrupted: 'paused',
};

/** Farbton eines Zustands: `running` blau, `completed` grün, `failed` rot, angehalten/unterbrochen grau. */
export function stateTone(state: BackgroundState): StateTone {
  return STATE_TONE[state];
}

const TONE_ICON: Record<StateTone, string> = {
  running: '●',
  completed: '✓',
  error: '✕',
  paused: '‖',
};

/** Ton einer Zeile: Zustandsfarben plus `muted` für Zurückhaltendes (fertig, Ordner). */
export type RowTone = StateTone | 'muted';

/** Ton der rechten Zustandsangabe: fertig bleibt zurückhaltend, alles andere trägt seine Farbe. */
export function stateRightTone(state: BackgroundState): RowTone {
  const tone: StateTone = STATE_TONE[state];
  return tone === 'completed' ? 'muted' : tone;
}

export function stateIcon(state: BackgroundState): string {
  return TONE_ICON[STATE_TONE[state]];
}

/** `0,4 s` unter einer Minute, sonst `m:ss`, ab einer Stunde `h:mm:ss`. */
export function formatDuration(milliseconds: number): string {
  const safe: number = Math.max(0, milliseconds);
  if (safe < SECONDS_PER_MINUTE * MS_PER_SECOND) {
    return `${(safe / MS_PER_SECOND).toFixed(1).replace('.', ',')} s`;
  }
  const totalSeconds: number = Math.floor(safe / MS_PER_SECOND);
  const hours: number = Math.floor(totalSeconds / SECONDS_PER_HOUR);
  const minutes: number = Math.floor((totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const paddedSeconds: string = String(totalSeconds % SECONDS_PER_MINUTE).padStart(2, '0');
  if (hours > 0) {
    return `${String(hours)}:${String(minutes).padStart(2, '0')}:${paddedSeconds}`;
  }
  return `${String(minutes)}:${paddedSeconds}`;
}

/** Lokale Uhrzeit `HH:MM`. */
export function formatTime(milliseconds: number): string {
  const date = new Date(milliseconds);
  const hours: string = String(date.getHours()).padStart(2, '0');
  const minutes: string = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}
