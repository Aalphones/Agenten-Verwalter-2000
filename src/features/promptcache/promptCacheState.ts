import type { ModelId } from '@/lib/bindings/ModelId';
import type { PromptCache } from '@/lib/bindings/PromptCache';

/**
 * Ab so vielen Token im Cache warnt die Eingabeleiste vor der nächsten Nachricht. Die Grundlast
 * jeder Session liegt gemessen bei rund 64 000 Token; darunter schreibt auch eine neue Session
 * ungefähr gleich viel neu, der Rat „neue Session“ spart dann nichts (ADR 033).
 */
export const COLD_HINT_MIN_TOKENS = 100_000;

const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const TTL_ONE_HOUR_MS = 3_600_000;
const TTL_FIVE_MINUTES_MS = 300_000;

export type PromptCacheState =
  /** Vor der ersten Antwort mit Cache-Angaben: es gibt nichts anzuzeigen. */
  | { kind: 'unknown' }
  | { kind: 'warm'; msLeft: number; minutesLeft: number; fractionLeft: number }
  | { kind: 'cold'; reason: 'expired'; idleMs: number; expiredAt: number }
  | { kind: 'cold'; reason: 'model' }
  | { kind: 'fresh' };

/** Ein Zustand, zu dem es etwas anzuzeigen gibt. */
export type KnownPromptCacheState = Exclude<PromptCacheState, { kind: 'unknown' }>;

/** Zustand des Prompt-Caches zum Zeitpunkt `now` (ms seit 1970) für eine Session mit `model`. */
export function promptCacheState(
  cache: PromptCache | null,
  model: ModelId,
  now: number,
): PromptCacheState {
  if (cache === null) {
    return { kind: 'unknown' };
  }
  if (cache.compactedAt !== null) {
    return { kind: 'fresh' };
  }
  // Der Cache gilt nur für das Modell, mit dem er geschrieben wurde.
  if (cache.model !== model) {
    return { kind: 'cold', reason: 'model' };
  }
  const msLeft: number = cache.anchorAt + cache.ttlMs - now;
  if (msLeft > 0) {
    return {
      kind: 'warm',
      msLeft,
      minutesLeft: Math.ceil(msLeft / MS_PER_MINUTE),
      fractionLeft: Math.min(1, msLeft / cache.ttlMs),
    };
  }
  return {
    kind: 'cold',
    reason: 'expired',
    idleMs: now - cache.anchorAt,
    expiredAt: cache.anchorAt + cache.ttlMs,
  };
}

/** „42 min“, „2 h“, „2 h 5 min“, „1 Tag“, „3 Tage 4 h“. */
export function formatIdle(milliseconds: number): string {
  const totalMinutes: number = Math.floor(milliseconds / MS_PER_MINUTE);
  if (totalMinutes < MINUTES_PER_HOUR) {
    return `${String(totalMinutes)} min`;
  }
  const totalHours: number = Math.floor(totalMinutes / MINUTES_PER_HOUR);
  const minutes: number = totalMinutes % MINUTES_PER_HOUR;
  if (totalHours < HOURS_PER_DAY) {
    if (minutes === 0) {
      return `${String(totalHours)} h`;
    }
    return `${String(totalHours)} h ${String(minutes)} min`;
  }
  const days: number = Math.floor(totalHours / HOURS_PER_DAY);
  const hours: number = totalHours % HOURS_PER_DAY;
  let dayText = '1 Tag';
  if (days > 1) {
    dayText = `${String(days)} Tage`;
  }
  if (hours === 0) {
    return dayText;
  }
  return `${dayText} ${String(hours)} h`;
}

/** Haltedauer in Worten: „1 Stunde“, „5 Minuten“. */
export function cacheTtlLabel(ttlMs: number): string {
  if (ttlMs === TTL_ONE_HOUR_MS) {
    return '1 Stunde';
  }
  if (ttlMs === TTL_FIVE_MINUTES_MS) {
    return '5 Minuten';
  }
  return `${String(Math.round(ttlMs / MS_PER_MINUTE))} Minuten`;
}
