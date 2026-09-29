import type { ScratchpadEntry } from '@/lib/bindings/ScratchpadEntry';

/** Dieselben fünf Endungen, die auch Anhänge zu Bildern machen. */
const IMAGE_EXTENSIONS: readonly string[] = ['png', 'jpg', 'jpeg', 'gif', 'webp'];

export interface ScratchpadRow {
  path: string;
  name: string;
  depth: number;
  isDir: boolean;
  isImage: boolean;
  sizeBytes: number;
  modifiedMs: number;
}

/** Der Dateiname ohne Ordner; `path` ist relativ und mit `/` getrennt. */
function baseName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

function isImagePath(path: string): boolean {
  const dot: number = path.lastIndexOf('.');
  if (dot === -1) {
    return false;
  }
  return IMAGE_EXTENSIONS.includes(path.slice(dot + 1).toLowerCase());
}

/** Zeilen für den Baum. Der Core liefert die Liste nach Pfad sortiert, Ordner stehen also vor ihrem Inhalt. */
export function buildScratchpadRows(entries: readonly ScratchpadEntry[]): ScratchpadRow[] {
  return entries.map((entry: ScratchpadEntry) => ({
    path: entry.path,
    name: baseName(entry.path),
    depth: entry.path.split('/').length - 1,
    isDir: entry.isDir,
    isImage: !entry.isDir && isImagePath(entry.path),
    sizeBytes: entry.sizeBytes,
    modifiedMs: entry.modifiedMs,
  }));
}
