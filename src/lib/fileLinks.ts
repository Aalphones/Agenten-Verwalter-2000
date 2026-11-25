import { invoke } from '@tauri-apps/api/core';
import type { FileLinkTarget } from '@/lib/bindings/FileLinkTarget';

/** Gespiegelt aus `file_links::OPENABLE_EXTENSIONS` in `src-tauri/src/file_links/mod.rs` (Rust ist maßgeblich).
 *  Hier entscheidet die Liste nur, was als Link erscheint; ob geöffnet wird, prüft der Core. */
export const OPENABLE_EXTENSIONS: readonly string[] = [
  'html',
  'htm',
  'pdf',
  'svg',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'md',
  'txt',
];

/** Gespiegelt aus `file_links::VIEWABLE_EXTENSIONS`: Quelltext- und Konfigurationsdateien, die „Dateien“
 *  anzeigt; auch sie erscheinen als Link im Chat. */
export const VIEWABLE_EXTENSIONS: readonly string[] = [
  'ts',
  'tsx',
  'js',
  'jsx',
  'mjs',
  'cjs',
  'rs',
  'py',
  'json',
  'jsonc',
  'css',
  'scss',
  'sass',
  'less',
  'vue',
  'svelte',
  'yml',
  'yaml',
  'toml',
  'ini',
  'sh',
  'ps1',
  'cmd',
  'bat',
  'sql',
  'kt',
  'kts',
  'java',
  'gradle',
  'xml',
  'cs',
  'go',
  'rb',
  'php',
  'c',
  'h',
  'cpp',
  'hpp',
  'swift',
  'dart',
  'proto',
  'graphql',
  'csv',
  'log',
  'lock',
];

/** Gespiegelt aus `file_links::EXTERNAL_EXTENSIONS`: öffnen im Standardprogramm, wenn sie im Vorhaben
 *  liegen. */
const EXTERNAL_EXTENSIONS: readonly string[] = ['html', 'htm'];

const FILE_URL_PREFIX = 'file:///';
const MAX_PATH_LENGTH = 400;
const LINE_NUMBER_SUFFIX = /(:\d+){1,2}$/;

/** Endung (klein) eines Dateilinks ohne Schema und angehängte Zeilennummer; `null`, wenn der Name keine hat. */
function extensionOf(text: string): string | null {
  let withoutScheme: string = text;
  if (text.toLowerCase().startsWith(FILE_URL_PREFIX)) {
    withoutScheme = text.slice(FILE_URL_PREFIX.length);
  }
  const withoutLineNumber: string = withoutScheme.replace(LINE_NUMBER_SUFFIX, '');
  const lastDot: number = withoutLineNumber.lastIndexOf('.');
  const lastSeparator: number = Math.max(
    withoutLineNumber.lastIndexOf('/'),
    withoutLineNumber.lastIndexOf('\\'),
  );
  if (lastDot <= lastSeparator + 1) {
    return null;
  }
  return withoutLineNumber.slice(lastDot + 1).toLowerCase();
}

/** Pfad, wenn `text` als Ganzes ein Dateiverweis ist, sonst `null`. Die angehängte Zeilennummer bleibt
 *  im Ergebnis stehen (der Core entfernt sie), damit Anzeige und Titel dem Original entsprechen. */
export function filePathOf(text: string): string | null {
  const trimmed: string = text.trim();
  if (trimmed === '' || trimmed.includes('\n') || trimmed.length > MAX_PATH_LENGTH) {
    return null;
  }
  let withoutScheme: string = trimmed;
  if (trimmed.toLowerCase().startsWith(FILE_URL_PREFIX)) {
    withoutScheme = trimmed.slice(FILE_URL_PREFIX.length);
  }
  if (withoutScheme.includes('://')) {
    return null;
  }
  const extension: string | null = extensionOf(trimmed);
  if (extension === null) {
    return null;
  }
  if (!OPENABLE_EXTENSIONS.includes(extension) && !VIEWABLE_EXTENSIONS.includes(extension)) {
    return null;
  }
  return trimmed;
}

/** Ob der Link als „öffnet im Standardprogramm“ gekennzeichnet wird; nur nach der Endung. */
export function isExternalLink(path: string): boolean {
  const extension: string | null = extensionOf(path.trim());
  return extension !== null && EXTERNAL_EXTENSIONS.includes(extension);
}

const WINDOWS_ABSOLUTE = /^[a-z]:[\\/]/i;
const FILE_URL_UNIX = /^file:\/\/(?=\/)/i;

/** `file:///`-Adresse für „Link-Adresse kopieren“ und die Statusleiste; `undefined` bei relativen
 *  Pfaden (die brauchen den Core). Ohne eigene Adresse wäre es `http://tauri.localhost/#`. */
export function fileHrefOf(path: string): string | undefined {
  if (path.startsWith('/')) {
    return `file://${encodeURI(path)}`;
  }
  const withoutScheme: string = path.replace(/^file:\/\/\//i, '');
  if (WINDOWS_ABSOLUTE.test(withoutScheme)) {
    return `${FILE_URL_PREFIX}${encodeURI(withoutScheme.replace(/\\/g, '/'))}`;
  }
  if (FILE_URL_UNIX.test(path)) {
    return `file://${encodeURI(path.replace(FILE_URL_UNIX, ''))}`;
  }
  return undefined;
}

/** Öffnet die Datei mit dem Standardprogramm.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound`, `fileNotFound`,
 *    `fileNotAllowed` (Dateityp oder außerhalb des Vorhabens), `io` (Öffnen gescheitert) */
export async function openFileLink(sessionId: string, path: string): Promise<void> {
  await invoke('file_link_open', { sessionId, path });
}

/** Fragt den Core, wohin der Link führt; öffnet selbst nichts.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound`, `fileNotFound`,
 *    `fileNotAllowed` (außerhalb des Vorhabens oder in keinem Repository) */
export async function resolveFileLink(sessionId: string, path: string): Promise<FileLinkTarget> {
  return invoke<FileLinkTarget>('file_link_resolve', { sessionId, path });
}
