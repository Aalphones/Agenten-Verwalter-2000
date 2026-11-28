import type { ReportPhase } from '@/lib/bindings/ReportPhase';

/** Wo die Ordnung einer Phase steht; die Zustandsleiste und das Inhaltsverzeichnis zeigen genau einen. */
export type ReportTidyStateKind =
  'tidying' | 'liveOpen' | 'liveOrdered' | 'failed' | 'ordered' | 'empty';

export function reportTidyState(phase: ReportPhase): ReportTidyStateKind {
  if (phase.tidyingSince !== null) {
    return 'tidying';
  }
  if (phase.state === 'running') {
    return phase.tidiedAt === null ? 'liveOpen' : 'liveOrdered';
  }
  if (phase.tidyError !== null) {
    return 'failed';
  }
  return phase.ordered ? 'ordered' : 'empty';
}

const clockFormat: Intl.DateTimeFormat = new Intl.DateTimeFormat('de-DE', {
  hour: '2-digit',
  minute: '2-digit',
});

/** „11:02“. */
export function formatClock(milliseconds: number): string {
  return clockFormat.format(new Date(milliseconds));
}

const MS_PER_MINUTE = 60_000;

/** Volle Minuten zwischen zwei Zeitpunkten, nie negativ. */
export function minutesBetween(from: number, to: number): number {
  return Math.max(0, Math.floor((to - from) / MS_PER_MINUTE));
}
