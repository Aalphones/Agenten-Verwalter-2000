import type { StyleColors } from '@/lib/bindings/StyleColors';

// Die Standardfarben des Verwalters aus `src/styles/theme.css`; dieselben Werte stehen in
// `StyleColors::standard_dark/light` im Kern. „Farben auf Standard“ stellt sie wieder her.

export const STANDARD_DARK: StyleColors = {
  base: '#1f1f1f',
  sidebar: '#181818',
  surface: '#252526',
  fg: '#d4d4d4',
  muted: '#8f8f8f',
  accent: '#e0825c',
  border: '#3c3c3c',
};

export const STANDARD_LIGHT: StyleColors = {
  base: '#ffffff',
  sidebar: '#f8f8f8',
  surface: '#ffffff',
  fg: '#3c3c3c',
  muted: '#6e6e6e',
  accent: '#a8461f',
  border: '#d9d9d9',
};

/** Feld → Beschriftung, in der Reihenfolge des Editors. */
export const COLOR_FIELDS: readonly { key: keyof StyleColors; label: string }[] = [
  { key: 'base', label: 'Hintergrund Inhalt' },
  { key: 'sidebar', label: 'Hintergrund Seitenleiste' },
  { key: 'surface', label: 'Flächen (Karten, Eingabe)' },
  { key: 'fg', label: 'Text' },
  { key: 'muted', label: 'Text gedämpft' },
  { key: 'accent', label: 'Akzent' },
  { key: 'border', label: 'Rahmen' },
];
