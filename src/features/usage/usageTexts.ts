import { formatClock, formatPercent } from '@/features/context/formatTokens';

const MS_PER_DAY = 86_400_000;

const LIMIT_LABEL: Readonly<Record<string, string>> = {
  session: 'Session (5 Std.)',
  weekly_all: 'Woche (alle Modelle)',
  weekly_opus: 'Woche (Opus)',
  weekly_sonnet: 'Woche (Sonnet)',
};

export interface BehaviorText {
  headline: string;
  /** `null` bei einem Schlüssel, den die Oberfläche nicht kennt. */
  explanation: string | null;
}

/** Bezeichnung eines Kontingents; ein unbekannter `kind` bleibt, wie er ist. */
export function limitLabel(kind: string): string {
  return LIMIT_LABEL[kind] ?? kind;
}

/** Überschrift und Erklärung eines Verbrauchstreibers („Was treibt den Verbrauch?“). */
export function behaviorText(key: string, percent: number): BehaviorText {
  const share: string = formatPercent(percent, 0);
  switch (key) {
    case 'long_context':
      return {
        headline: `${share} deines Verbrauchs lief mit mehr als 150k Kontext`,
        explanation:
          'Lange Sessions kosten mehr, auch mit Cache. Für ein neues Thema eine neue Session anlegen.',
      };
    case 'cron':
      return {
        headline: `${share} kam aus Sessions, die 8+ Stunden aktiv waren`,
        explanation:
          'Oft Hintergrund- oder Schleifen-Sessions; Dauerbetrieb summiert sich schnell.',
      };
    case 'high_parallel':
      return {
        headline: `${share} lief, während 4+ Sessions parallel arbeiteten`,
        explanation: 'Alle Sessions teilen sich ein Kontingent.',
      };
    default:
      return { headline: `${share} · ${key}`, explanation: null };
  }
}

/** Wochentag ohne Datum: „Fr.“, „Mo.“. */
const WEEKDAY_FORMAT = new Intl.DateTimeFormat('de-DE', { weekday: 'short' });

/**
 * Konkreter Reset-Zeitpunkt: „um 15:30 Uhr“, „morgen um 15:30 Uhr“, „Fr. um 15:30 Uhr“.
 * `null`, wenn der Zeitpunkt unlesbar ist oder nicht mehr in der Zukunft liegt.
 */
export function formatResetAt(resetsAt: string, now: number): string | null {
  const resetMs: number = Date.parse(resetsAt);
  if (Number.isNaN(resetMs) || resetMs <= now) {
    return null;
  }
  const reset = new Date(resetMs);
  const clock = `um ${formatClock(resetMs)} Uhr`;
  const dayDifference: number = Math.round(
    (startOfDay(reset) - startOfDay(new Date(now))) / MS_PER_DAY,
  );
  if (dayDifference <= 0) {
    return clock;
  }
  if (dayDifference === 1) {
    return `morgen ${clock}`;
  }
  return `${WEEKDAY_FORMAT.format(reset)} ${clock}`;
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}
