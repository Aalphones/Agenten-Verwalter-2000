import type { ImplementationView } from '@/lib/bindings/ImplementationView';
import type { PhaseView } from '@/lib/bindings/PhaseView';
import type { StationState } from '@/lib/bindings/StationState';
import type { StationView } from '@/lib/bindings/StationView';
import type { ImplementationViewKind } from '@/stores/sessions';

export const VIEW_LABEL: Record<ImplementationViewKind, string> = {
  flow: 'Ablauf',
  changes: 'Changes',
};

export const REPORT_LABEL = 'Lagebericht';
export const REPORT_LOADING = 'Lagebericht wird geladen …';

/** „Phase 2 von 7 · 6 von 16 Sessions fertig“. */
export function progressLine(implementation: ImplementationView): string {
  return `Phase ${String(implementation.currentPhase)} von ${String(implementation.phases.length)} · ${String(implementation.stationsDone)} von ${String(implementation.stationsTotal)} Sessions fertig`;
}

/** „6/16“ in der Sidebar. */
export function progressShort(implementation: ImplementationView): string {
  return `${String(implementation.stationsDone)}/${String(implementation.stationsTotal)}`;
}

export const AUTO_START_LABEL = 'Automatisch weiter';
export const AUTO_START_TITLE =
  'Startet die nächste Station von selbst, 10 Sekunden nach der Fertigmeldung';
export const STOP_AFTER_LABEL = 'Anhalten nach dieser Session';
export const STOP_AFTER_TITLE = 'Die laufende Station läuft zu Ende, danach startet nichts mehr';
export const BACK_TO_CURRENT_LABEL = 'Zur aktuellen';
export const BACK_TO_CURRENT_TITLE = 'Springt zurück zur Station, die gerade läuft oder fragt';
export const OPEN_CHAT_LABEL = 'Chat öffnen';
export const OPEN_CHAT_TITLE = 'Öffnet die Session dieser Station; Fragen beantwortest du dort';
export const START_NOW_LABEL = '▶ Jetzt starten';
export const START_NOW_TITLE = 'Startet diese Station sofort als neue Session';
export const CANCEL_COUNTDOWN_LABEL = 'Abbrechen';
export const CANCEL_COUNTDOWN_TITLE = 'Hält den Countdown an; die Station bleibt bereit';
export const DONE_BY_USER_RESULT = 'vom Benutzer erledigt';
export const DONE_BY_USER_LABEL = 'Erledigt';
export const DONE_BY_USER_TITLE = 'Meldet diese Station als fertig, damit die nächste starten darf';
export const REPORT_TITLE =
  'Zeigt den Lagebericht, den auch der Agent über implementation_get liest';
export const TIMELINE_LABEL = 'Zeitleiste der Umsetzung';
export const NO_PHASES = 'Diese Umsetzung hat noch keine Phasen.';

const MINUTE_MS = 60_000;
const HOUR_MINUTES = 60;

/** „8 min“, „1 h 5 min“; unter einer Minute „< 1 min“. */
export function durationText(milliseconds: number): string {
  const minutes: number = Math.floor(milliseconds / MINUTE_MS);
  if (minutes < 1) {
    return '< 1 min';
  }
  if (minutes < HOUR_MINUTES) {
    return `${String(minutes)} min`;
  }
  const rest: number = minutes % HOUR_MINUTES;
  const hours: string = String(Math.floor(minutes / HOUR_MINUTES));
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest)} min`;
}

/** Zustand der Station als Satz für die große Karte („läuft seit 12 min“, „fertig · 24 min“). */
export function stateText(station: StationView, now: number): string {
  switch (station.state) {
    case 'running':
    case 'starting':
      return `läuft seit ${durationText(runningFor(station, now))}`;
    case 'asking':
      return 'fragt dich';
    case 'waitsForYou':
      return 'wartet auf dich';
    case 'done':
      return `fertig · ${durationText(station.runningMs)}`;
    case 'error':
      return 'Fehler';
    case 'countdown':
      return countdownText(station, now);
    case 'ready':
    case 'pending':
      return 'wartet auf Start';
  }
}

/** Kurzfassung für die Zeitleiste: Dauer, „läuft“, „fragt“ — leer, solange nichts war. */
export function stationMeta(station: StationView, now: number): string {
  switch (station.state) {
    case 'done':
      return durationText(station.runningMs);
    case 'running':
    case 'starting':
      return `läuft ${durationText(runningFor(station, now))}`;
    case 'asking':
      return 'fragt';
    case 'waitsForYou':
      return 'wartet';
    case 'error':
      return 'Fehler';
    case 'countdown':
      return countdownText(station, now);
    case 'ready':
    case 'pending':
      return '';
  }
}

/** Zustand einer ganzen Phase als Überschrift-Zusatz. */
export function phaseMeta(phase: PhaseView): string {
  const states: StationState[] = phase.stations.map((station: StationView) => station.state);
  if (states.every((state: StationState) => state === 'done')) {
    const total: number = phase.stations.reduce(
      (sum: number, station: StationView) => sum + station.runningMs,
      0,
    );
    return `fertig · ${durationText(total)}`;
  }
  const checks: [StationState[], string][] = [
    [['asking', 'waitsForYou'], 'fragt dich'],
    [['error'], 'Fehler'],
    [['running', 'starting', 'countdown'], 'läuft'],
    [['ready'], 'bereit'],
  ];
  for (const [matching, text] of checks) {
    if (states.some((state: StationState) => matching.includes(state))) {
      return text;
    }
  }
  return states.some((state: StationState) => state === 'done') ? 'läuft' : 'geplant';
}

function runningFor(station: StationView, now: number): number {
  if (station.startedAt === null) {
    return station.runningMs;
  }
  return Math.max(station.runningMs, now - station.startedAt);
}

function countdownText(station: StationView, now: number): string {
  if (station.startsAt === null) {
    return 'startet gleich';
  }
  const seconds: number = Math.max(0, Math.ceil((station.startsAt - now) / 1000));
  return `startet in ${String(seconds)} s`;
}

export function implementationTitle(implementation: ImplementationView): string {
  return `Umsetzung ${implementation.name}`;
}
