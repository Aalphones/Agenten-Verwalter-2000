import { formatPercent } from '@/features/context/formatTokens';

/** Ab diesem Prozentwert färbt die Oberfläche ein Kontingent als Warnung. */
export const USAGE_WARNING_PERCENT = 90;

const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_TWO_DAYS = 48;
const HOURS_PER_DAY = 24;

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

/** „in 12 Min.“, „in 3 Std.“, „in 5 Tagen“; `null`, wenn der Zeitpunkt unlesbar ist oder nicht mehr in der Zukunft liegt. */
export function formatResetIn(resetsAt: string, now: number): string | null {
  const resetMs: number = Date.parse(resetsAt);
  if (Number.isNaN(resetMs) || resetMs <= now) {
    return null;
  }
  const minutes: number = Math.max(1, Math.round((resetMs - now) / MS_PER_MINUTE));
  if (minutes < MINUTES_PER_HOUR) {
    return `in ${String(minutes)} Min.`;
  }
  const hours: number = Math.round(minutes / MINUTES_PER_HOUR);
  if (hours < HOURS_PER_TWO_DAYS) {
    return `in ${String(hours)} Std.`;
  }
  return `in ${String(Math.round(hours / HOURS_PER_DAY))} Tagen`;
}
