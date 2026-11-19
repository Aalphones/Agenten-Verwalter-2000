import type { RunProgress } from '@/lib/bindings/RunProgress';

/** Ab diesem Alter gilt ein Befehl als langer Lauf: Seitenleiste und Kopfzeile zeigen Rest, Fortschritt oder Laufzeit. */
export const LONGRUN_AFTER_MS = 5000;
/** Ab diesem Alter zeigt die Statuszeile den Lauf; vorher sieht sie aus wie bei jedem kurzen Befehl. */
export const RUN_VISIBLE_AFTER_MS = 2000;

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const REST_ROUND_SECONDS = 5;
const REST_MINUTES_FROM_SECONDS = 600;
/** Der geschätzte Balken erreicht nie ganz das Ende; erst ein gemeldetes Ende füllt ihn. */
const ESTIMATE_FRACTION_CAP = 0.95;
const FRACTION_FULL = 1;
const SHORT_DURATION_MS = 10_000;

/** Die Angaben, die ein laufender Befehl (`RunStatus`) und ein erwartetes Skript (`AwaitedScript`) gemeinsam tragen. */
export interface RunInput {
  /** Millisekunden seit der Epoche. */
  startedAt: number;
  expectedMs: number | null;
  progress: RunProgress | null;
  lastLine: string | null;
}

export type RunKind = 'measured' | 'estimated' | 'overdue' | 'none';

export interface RunView {
  elapsedSeconds: number;
  /** Füllung des Balkens, 0 bis 1; `null` ohne Balken. */
  fraction: number | null;
  kind: RunKind;
  /** Gemessener Fortschritt für `{fortschritt}`, z. B. `12/40`; sonst leer. */
  progressLabel: string;
  /** Wert neben dem Balken: `12/40`, `45 %` oder `üblich ~m:ss`; bei Überziehen und ohne Balken leer. */
  valueLabel: string;
  /** Restdauer `~1:25`; `null`, wenn keine bekannt ist. */
  restLabel: string | null;
  /** Die übliche Dauer `~m:ss`; `null` ohne Schätzung. */
  expectedLabel: string | null;
  lastLine: string | null;
}

/** `12/40` bzw. `45 %`. */
export function formatProgress(progress: RunProgress): string {
  if (progress.unit === 'percent') {
    return `${String(progress.done)} %`;
  }
  return `${String(progress.done)}/${String(progress.total)}`;
}

/** Restdauer: ab 600 s `~<n> min`, darunter `~m:ss` auf 5 s gerundet, mindestens `~0:05`. */
export function formatRest(seconds: number): string {
  if (seconds >= REST_MINUTES_FROM_SECONDS) {
    return `~${String(Math.round(seconds / SECONDS_PER_MINUTE))} min`;
  }
  const rounded: number = Math.max(
    REST_ROUND_SECONDS,
    Math.round(seconds / REST_ROUND_SECONDS) * REST_ROUND_SECONDS,
  );
  const minutes: number = Math.floor(rounded / SECONDS_PER_MINUTE);
  return `~${String(minutes)}:${String(rounded % SECONDS_PER_MINUTE).padStart(2, '0')}`;
}

/** Dauer eines beendeten Befehls: unter 10 s `0,4 s`, sonst `m:ss`. */
export function formatCommandDuration(milliseconds: number): string {
  const safe: number = Math.max(0, milliseconds);
  if (safe < SHORT_DURATION_MS) {
    return `${(safe / MS_PER_SECOND).toFixed(1).replace('.', ',')} s`;
  }
  return formatMinutes(Math.floor(safe / MS_PER_SECOND));
}

function formatMinutes(totalSeconds: number): string {
  const minutes: number = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
  return `${String(minutes)}:${String(totalSeconds % SECONDS_PER_MINUTE).padStart(2, '0')}`;
}

function hasMeasuredProgress(progress: RunProgress | null): progress is RunProgress {
  return progress !== null && progress.done > 0 && progress.done < progress.total;
}

/** Was die Oberfläche über einen laufenden Befehl zeigt, nach „Restdauer und Balken“ des Plans. Die Uhr kommt von außen. */
export function runView(run: RunInput, now: number): RunView {
  const elapsedMs: number = Math.max(0, now - run.startedAt);
  const elapsedSeconds: number = Math.floor(elapsedMs / MS_PER_SECOND);
  const expectedMs: number | null =
    run.expectedMs !== null && run.expectedMs > 0 ? run.expectedMs : null;
  const expectedLabel: string | null =
    expectedMs === null ? null : formatRest(expectedMs / MS_PER_SECOND);
  const base = { elapsedSeconds, expectedLabel, lastLine: run.lastLine };

  if (hasMeasuredProgress(run.progress)) {
    const restSeconds: number =
      (elapsedMs * (run.progress.total - run.progress.done)) / run.progress.done / MS_PER_SECOND;
    const label: string = formatProgress(run.progress);
    return {
      ...base,
      kind: 'measured',
      fraction: run.progress.done / run.progress.total,
      progressLabel: label,
      valueLabel: label,
      restLabel: formatRest(restSeconds),
    };
  }
  if (expectedMs !== null && elapsedMs <= expectedMs) {
    return {
      ...base,
      kind: 'estimated',
      fraction: Math.min(ESTIMATE_FRACTION_CAP, elapsedMs / expectedMs),
      progressLabel: '',
      valueLabel: `üblich ${expectedLabel ?? ''}`,
      restLabel: formatRest((expectedMs - elapsedMs) / MS_PER_SECOND),
    };
  }
  if (expectedMs !== null) {
    return {
      ...base,
      kind: 'overdue',
      fraction: FRACTION_FULL,
      progressLabel: '',
      valueLabel: '',
      restLabel: null,
    };
  }
  return {
    ...base,
    kind: 'none',
    fraction: null,
    progressLabel: '',
    valueLabel: '',
    restLabel: null,
  };
}

/** Kurzangabe für Seitenleiste und Kopfzeile: ab 5 s `noch <Rest>`, sonst der Fortschritt, sonst die Laufzeit; davor leer. */
export function runClockLabel(view: RunView): string {
  if (view.elapsedSeconds * MS_PER_SECOND < LONGRUN_AFTER_MS) {
    return '';
  }
  if (view.restLabel !== null) {
    return `noch ${view.restLabel}`;
  }
  if (view.progressLabel !== '') {
    return view.progressLabel;
  }
  return formatMinutes(view.elapsedSeconds);
}
