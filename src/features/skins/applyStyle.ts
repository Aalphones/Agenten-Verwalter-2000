import type { SkinPack } from '@/lib/bindings/SkinPack';
import type { StyleColors } from '@/lib/bindings/StyleColors';
import type { StyleData } from '@/lib/bindings/StyleData';
import { contrastRatio } from './contrast';
import { styleOf } from './styleOf';

const STYLE_ELEMENT_ID = 'skin-style';
const STYLE_CLASS = 'skin-style';
const BACKDROP_CLASS = 'skin-backdrop-on';

const LIGHT_ON_ACCENT = '#ffffff';
const DARK_ON_ACCENT = '#111111';
/** Anteil des Akzents im abgesetzten Akzent-Grund: dunkel kräftiger, damit er auf dunkel trägt. */
const ACCENT_SUBTLE_DARK_PERCENT = 16;
const ACCENT_SUBTLE_LIGHT_PERCENT = 10;

/** Schrift auf Akzentflächen: die der beiden Farben, die mehr Kontrast zum Akzent hat. */
function onAccentColor(accent: string): string {
  const lightContrast: number = contrastRatio(accent, LIGHT_ON_ACCENT);
  const darkContrast: number = contrastRatio(accent, DARK_ON_ACCENT);
  return lightContrast >= darkContrast ? LIGHT_ON_ACCENT : DARK_ON_ACCENT;
}

/** Die Farb-Tokens eines Farbsatzes als CSS-Deklarationen; alle anderen Tokens bleiben unberührt. */
function tokenDeclarations(colors: StyleColors, accentSubtlePercent: number): string {
  const declarations: string[] = [
    `--color-bg-base: ${colors.base}`,
    `--color-bg-sidebar: ${colors.sidebar}`,
    `--color-bg-surface: ${colors.surface}`,
    `--color-bg-popover: ${colors.surface}`,
    `--color-bg-hover: color-mix(in srgb, ${colors.surface} 88%, ${colors.fg})`,
    `--color-bg-selected: color-mix(in srgb, ${colors.surface} 80%, ${colors.fg})`,
    `--color-border: ${colors.border}`,
    `--color-border-subtle: color-mix(in srgb, ${colors.border} 55%, ${colors.base})`,
    `--color-fg-primary: ${colors.fg}`,
    `--color-fg-secondary: color-mix(in srgb, ${colors.fg} 70%, ${colors.muted})`,
    `--color-fg-muted: ${colors.muted}`,
    `--color-accent: ${colors.accent}`,
    `--color-accent-text: ${colors.accent}`,
    `--color-toggle-on: ${colors.accent}`,
    `--color-status-handoff: ${colors.accent}`,
    `--color-accent-subtle: color-mix(in srgb, ${colors.accent} ${String(accentSubtlePercent)}%, transparent)`,
    `--color-fg-on-accent: ${onAccentColor(colors.accent)}`,
  ];
  return declarations.map((declaration: string) => `${declaration};`).join(' ');
}

/**
 * Die Regeln des Stilpakets. Hell gilt ohne Klasse und bei `.light`; dunkel bei `.dark` und, wenn
 * keine Klasse das Schema erzwingt, bei einem dunklen System. Die dunklen Selektoren sind
 * spezifischer als der helle, deshalb gewinnen sie, wo beide passen.
 */
function buildCss(style: StyleData): string {
  const light: string = tokenDeclarations(style.light, ACCENT_SUBTLE_LIGHT_PERCENT);
  const dark: string = tokenDeclarations(style.dark, ACCENT_SUBTLE_DARK_PERCENT);
  return [
    `:root.${STYLE_CLASS} { ${light} }`,
    `@media (prefers-color-scheme: dark) { :root.${STYLE_CLASS}:not(.light) { ${dark} } }`,
    `:root.${STYLE_CLASS}.dark { ${dark} }`,
  ].join('\n');
}

function hasBackdropImage(style: StyleData): boolean {
  return style.sidebarImage !== null || style.contentImage !== null;
}

function removeStyle(): void {
  document.getElementById(STYLE_ELEMENT_ID)?.remove();
  document.documentElement.classList.remove(STYLE_CLASS, BACKDROP_CLASS);
}

/**
 * Wendet ein Stilpaket auf die App an: ein `<style>` im Kopf mit den Farben, die Klasse
 * `skin-style` und, solange ein Hintergrundbild aktiv ist, `skin-backdrop-on` am Wurzelelement.
 * Ohne Stilpaket (`null`, auch ein Figurenpaket) verschwindet alles wieder.
 */
export function applyStyle(pack: SkinPack | null): void {
  const style: StyleData | null = styleOf(pack);
  if (style === null) {
    removeStyle();
    return;
  }
  let element: HTMLElement | null = document.getElementById(STYLE_ELEMENT_ID);
  if (element === null) {
    element = document.createElement('style');
    element.id = STYLE_ELEMENT_ID;
    document.head.appendChild(element);
  }
  element.textContent = buildCss(style);
  const classList: DOMTokenList = document.documentElement.classList;
  classList.add(STYLE_CLASS);
  classList.toggle(BACKDROP_CLASS, hasBackdropImage(style));
}
