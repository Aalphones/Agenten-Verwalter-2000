import type { ArtifactKind } from '@/lib/bindings/ArtifactKind';
import type { FileSource } from '@/stores/files';

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
  jpeg: { label: '▣', tone: 'done' },
  gif: { label: '▣', tone: 'done' },
  webp: { label: '▣', tone: 'done' },
  mp4: { label: 'VID', tone: 'scr' },
  webm: { label: 'VID', tone: 'scr' },
  mp3: { label: '♪', tone: 'scr' },
  wav: { label: '♪', tone: 'scr' },
  ogg: { label: '♪', tone: 'scr' },
  m4a: { label: '♪', tone: 'scr' },
  pdf: { label: 'PDF', tone: 'err' },
  cmd: { label: '>_', tone: 'mut' },
  sh: { label: '>_', tone: 'mut' },
  zip: { label: 'ZIP', tone: 'mut' },
};

/** Endung in Kleinbuchstaben ohne Punkt; leer ohne Endung. Der Pfad darf `/` oder `\` trennen. */
export function extensionOf(path: string): string {
  const name: string = path.slice(Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1);
  const dot: number = name.lastIndexOf('.');
  return dot <= 0 ? '' : name.slice(dot + 1).toLowerCase();
}

export function fileTypeOf(path: string): FileType | null {
  return TYPES[extensionOf(path)] ?? null;
}

const KIND_EXTENSIONS: Readonly<Record<string, readonly string[]>> = {
  html: ['html', 'htm'],
  markdown: ['md', 'markdown'],
  json: ['json'],
  'json-lines': ['jsonl', 'ndjson'],
  yaml: ['yaml', 'yml'],
  config: ['toml', 'ini', 'env'],
  xml: ['xml'],
  csv: ['csv', 'tsv'],
  text: ['txt'],
  log: ['log'],
  diff: ['diff', 'patch'],
  mermaid: ['mmd', 'mermaid'],
  image: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg', 'ico'],
  video: ['mp4', 'webm'],
  audio: ['mp3', 'wav', 'ogg', 'm4a'],
  pdf: ['pdf'],
  code: [
    'ts',
    'tsx',
    'js',
    'jsx',
    'mjs',
    'py',
    'rs',
    'go',
    'kt',
    'java',
    'cs',
    'sql',
    'sh',
    'ps1',
    'bat',
    'cmd',
    'css',
    'scss',
    'c',
    'cpp',
    'h',
    'rb',
    'php',
    'swift',
  ],
};

/** Endung (klein) → Typ. Gespiegelt aus `artifacts::kind_of` (`src-tauri/src/artifacts/mod.rs`, Rust ist
 *  maßgeblich); Namen, die mit `.env` beginnen, sind Konfiguration. Was fehlt, ist `other`. */
const KIND_BY_EXTENSION: ReadonlyMap<string, ArtifactKind> = new Map(
  Object.entries(KIND_EXTENSIONS).flatMap(([kind, extensions]: [string, readonly string[]]) =>
    extensions.map((extension: string): [string, ArtifactKind] => [
      extension,
      kind as ArtifactKind,
    ]),
  ),
);

/** Typ einer Datei nach dem Namen; für Session-Dateien liefert der Core `SessionFile.kind`, hier gilt dieselbe
 *  Zuordnung für Dateien in Repositories. */
export function kindOfPath(path: string): ArtifactKind {
  const name: string = path.slice(Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1);
  if (name.toLowerCase().startsWith('.env')) {
    return 'config';
  }
  return KIND_BY_EXTENSION.get(extensionOf(path)) ?? 'other';
}

/** Wie die Datei-Ansicht einen Typ zeigt. `viewer`: Betrachter-Rahmen statt Text; `preview`: Text, dazu der Schalter
 *  „Vorschau“ mit dem Betrachter; `page`: HTML, nur als Karte; `text`: gelesener Text, bei Binärdateien die Karte
 *  „Für diesen Typ gibt es keine Ansicht.“ */
export type ViewMode = 'viewer' | 'preview' | 'page' | 'text';

const VIEWER_KINDS: readonly ArtifactKind[] = ['image', 'video', 'audio', 'pdf'];
const PREVIEW_KINDS: readonly ArtifactKind[] = [
  'markdown',
  'csv',
  'json',
  'json-lines',
  'yaml',
  'xml',
  'mermaid',
];

export function viewModeOf(kind: ArtifactKind): ViewMode {
  if (VIEWER_KINDS.includes(kind)) {
    return 'viewer';
  }
  if (PREVIEW_KINDS.includes(kind)) {
    return 'preview';
  }
  return kind === 'html' ? 'page' : 'text';
}

/** Wie die Datei-Ansicht eine Datei zeigt. HTML im Repository bleibt Text (Quelltext); nur eine Session-Datei
 *  bekommt die Karte, weil die relativen Bilder und Skripte ihrer Seite nicht hinter der Betrachter-Adresse
 *  liegen. */
export function viewModeFor(source: FileSource, kind: ArtifactKind): ViewMode {
  const mode: ViewMode = viewModeOf(kind);
  return mode === 'page' && source === 'repo' ? 'text' : mode;
}

/** „Betrachter · <Typ>“ in der Leiste des Rahmens und „Typ“ der Karte. */
export const KIND_WORDS: Readonly<Record<ArtifactKind, string>> = {
  html: 'HTML-Seite',
  site: 'Webseite',
  folder: 'Ordner',
  markdown: 'Markdown',
  json: 'JSON',
  'json-lines': 'JSON Lines',
  yaml: 'YAML',
  config: 'Konfiguration',
  xml: 'XML',
  csv: 'CSV',
  code: 'Code',
  text: 'Text',
  log: 'Log',
  diff: 'Diff',
  image: 'Bild',
  video: 'Video',
  audio: 'Ton',
  pdf: 'PDF',
  mermaid: 'Mermaid',
  other: 'Datei',
};

/** „Typ“ der Karte: das Typwort; bei `other` die Endung („BAK-Datei“) oder „Datei ohne Endung“. */
export function typeWordOf(kind: ArtifactKind, path: string): string {
  if (kind !== 'other') {
    return KIND_WORDS[kind];
  }
  const extension: string = extensionOf(path);
  return extension === '' ? 'Datei ohne Endung' : `${extension.toUpperCase()}-Datei`;
}
