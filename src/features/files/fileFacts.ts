import { formatCount } from '@/features/changes/changesScope';

const BYTES_PER_KB = 1024;
const BYTES_PER_MB = 1024 * 1024;

/** Kilobyte oder Megabyte, je nach Größe; deutsche Zahlenschreibweise. */
export function sizeText(bytes: number): string {
  if (bytes >= BYTES_PER_MB) {
    return `${(bytes / BYTES_PER_MB).toFixed(1).replace('.', ',')} MB`;
  }
  return `${formatCount(Math.max(1, Math.round(bytes / BYTES_PER_KB)))} KB`;
}

/** Name hinter dem letzten `/` oder `\`. */
export function nameOf(path: string): string {
  return path.slice(Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1);
}

/** Ordner vor dem letzten `/` oder `\`; leer, wenn der Pfad keinen Ordner hat. */
export function folderOf(path: string): string {
  return path.slice(0, Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'), 0));
}
