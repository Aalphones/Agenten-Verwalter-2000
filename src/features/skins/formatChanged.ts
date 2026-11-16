const RELATIVE = new Intl.RelativeTimeFormat('de', { numeric: 'auto' });

const UNITS: readonly { unit: Intl.RelativeTimeFormatUnit; seconds: number }[] = [
  { unit: 'day', seconds: 86400 },
  { unit: 'hour', seconds: 3600 },
  { unit: 'minute', seconds: 60 },
];

/** „vor 5 Minuten“, „gestern“ – für den Zeitpunkt einer Änderung; unlesbare Zeitpunkte ergeben „unbekannt“. */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const time: number = Date.parse(iso);
  if (Number.isNaN(time)) {
    return 'unbekannt';
  }
  const seconds: number = Math.round((time - now) / 1000);
  for (const { unit, seconds: size } of UNITS) {
    if (Math.abs(seconds) >= size) {
      return RELATIVE.format(Math.round(seconds / size), unit);
    }
  }
  return 'gerade eben';
}

/** Wer zuletzt geändert hat: `null` ist der Benutzer, sonst steht dort die Session des Agenten. */
export function changedByText(changedBy: string | null): string {
  return changedBy ?? 'du';
}
