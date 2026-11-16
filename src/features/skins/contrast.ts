import type { StyleColors } from '@/lib/bindings/StyleColors';

/** Mindestverhältnis für Text (WCAG AA). */
export const MIN_TEXT_CONTRAST = 4.5;
/** Mindestverhältnis für Akzent als Bedienelement und Grafik (WCAG AA). */
export const MIN_ACCENT_CONTRAST = 3;

const SRGB_LINEAR_CUTOFF = 0.03928;
const HEX_PAIR = /[0-9a-f]{2}/gi;

function linearChannel(channel: number): number {
  const fraction: number = channel / 255;
  if (fraction <= SRGB_LINEAR_CUTOFF) {
    return fraction / 12.92;
  }
  return Math.pow((fraction + 0.055) / 1.055, 2.4);
}

/** Relative Leuchtdichte einer `#rrggbb`-Farbe nach WCAG. */
function luminance(hex: string): number {
  const pairs: string[] = hex.match(HEX_PAIR) ?? [];
  const [red, green, blue]: number[] = pairs.map((pair: string) =>
    linearChannel(parseInt(pair, 16)),
  );
  return 0.2126 * (red ?? 0) + 0.7152 * (green ?? 0) + 0.0722 * (blue ?? 0);
}

/** Kontrastverhältnis zweier `#rrggbb`-Farben (1 bis 21), unabhängig von der Reihenfolge. */
export function contrastRatio(first: string, second: string): number {
  const firstLuminance: number = luminance(first);
  const secondLuminance: number = luminance(second);
  const lighter: number = Math.max(firstLuminance, secondLuminance);
  const darker: number = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Auf eine Nachkommastelle abgeschnitten, damit „4,5:1 – unter 4,5:1“ nie vorkommt. */
function formatRatio(ratio: number): string {
  return (Math.floor(ratio * 10) / 10).toFixed(1).replace('.', ',');
}

export type ContrastField = keyof StyleColors;

/**
 * Warnsatz für eine Farbe, die zu schwach gegen ihren Untergrund steht; `null`, wenn sie reicht
 * oder für das Feld keine Regel gilt. Text und gedämpfter Text gegen Inhalt und Flächen
 * (4,5:1), Akzent gegen Inhalt (3:1).
 */
export function contrastWarning(colors: StyleColors, field: ContrastField): string | null {
  if (field === 'fg' || field === 'muted') {
    const ratio: number = Math.min(
      contrastRatio(colors[field], colors.base),
      contrastRatio(colors[field], colors.surface),
    );
    return ratio < MIN_TEXT_CONTRAST ? `Kontrast ${formatRatio(ratio)}:1 – unter 4,5:1` : null;
  }
  if (field === 'accent') {
    const ratio: number = contrastRatio(colors.accent, colors.base);
    return ratio < MIN_ACCENT_CONTRAST ? `Kontrast ${formatRatio(ratio)}:1 – unter 3:1` : null;
  }
  return null;
}
