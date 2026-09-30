const TOKENS_PER_THOUSAND = 1000;
const TOKENS_PER_MILLION = 1_000_000;
// Ab hier rundet „999,95k“ auf „1000,0k“; die Anzeige wechselt schon vorher auf Millionen.
const MILLION_SWITCH = 999_950;

const ONE_DECIMAL = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  useGrouping: false,
});
const WHOLE_NUMBER = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
const PERCENT_WHOLE = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
const PERCENT_ONE_DECIMAL = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** „842“, „98,3k“, „1,0M“. */
export function formatTokens(tokens: number): string {
  if (tokens < TOKENS_PER_THOUSAND) {
    return WHOLE_NUMBER.format(tokens);
  }
  if (tokens < MILLION_SWITCH) {
    return `${ONE_DECIMAL.format(tokens / TOKENS_PER_THOUSAND)}k`;
  }
  return `${ONE_DECIMAL.format(tokens / TOKENS_PER_MILLION)}M`;
}

/** Auf tausend gerundet: „42k“. */
export function formatThousands(tokens: number): string {
  return `${String(Math.round(tokens / TOKENS_PER_THOUSAND))}k`;
}

/** „10 %“ beziehungsweise „0,3 %“ — mit normalem Leerzeichen. */
export function formatPercent(value: number, digits: 0 | 1): string {
  const format: Intl.NumberFormat = digits === 0 ? PERCENT_WHOLE : PERCENT_ONE_DECIMAL;
  return `${format.format(value)} %`;
}

/** Uhrzeit aus Millisekunden seit 1970, `HH:MM`. */
export function formatClock(milliseconds: number): string {
  return new Date(milliseconds).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
