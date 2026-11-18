/** Farbe des Typ-Kürzels; die CSS-Klasse `file-type--<Ton>` liest das passende semantische Token. */
export type FileTypeTone = 'run' | 'wait' | 'acc' | 'scr' | 'err' | 'done' | 'mut';

export interface FileType {
  label: string;
  tone: FileTypeTone;
}

/** Zuordnung aus dem Entwurf (`TYPES`); fehlt die Endung, zeigt die Zeile ein schlichtes Datei-Symbol. */
const TYPES: Readonly<Record<string, FileType>> = {
  ts: { label: 'TS', tone: 'run' },
  tsx: { label: 'TS', tone: 'run' },
  js: { label: 'JS', tone: 'wait' },
  cjs: { label: 'JS', tone: 'wait' },
  mjs: { label: 'JS', tone: 'wait' },
  rs: { label: 'RS', tone: 'acc' },
  css: { label: '#', tone: 'scr' },
  json: { label: '{}', tone: 'wait' },
  md: { label: 'M↓', tone: 'mut' },
  html: { label: '<>', tone: 'err' },
  svg: { label: '<>', tone: 'done' },
  xml: { label: '<>', tone: 'err' },
  kt: { label: 'KT', tone: 'scr' },
  toml: { label: '⚙', tone: 'mut' },
  yml: { label: '⚙', tone: 'mut' },
  yaml: { label: '⚙', tone: 'mut' },
  png: { label: '▣', tone: 'done' },
  ico: { label: '▣', tone: 'done' },
  icns: { label: '▣', tone: 'done' },
  jpg: { label: '▣', tone: 'done' },
  pdf: { label: 'PDF', tone: 'err' },
  cmd: { label: '>_', tone: 'mut' },
  sh: { label: '>_', tone: 'mut' },
  zip: { label: 'ZIP', tone: 'mut' },
};

/** Endung in Kleinbuchstaben ohne Punkt; leer ohne Endung. */
export function extensionOf(path: string): string {
  const name: string = path.slice(path.lastIndexOf('/') + 1);
  const dot: number = name.lastIndexOf('.');
  return dot <= 0 ? '' : name.slice(dot + 1).toLowerCase();
}

export function fileTypeOf(path: string): FileType | null {
  return TYPES[extensionOf(path)] ?? null;
}
