const BYTES_PER_KB = 1024;
const BYTES_PER_MB = 1024 * 1024;

/** Größe für Chips: `812 B`, `48 KB`, `1,5 MB`. */
export function formatBytes(bytes: number): string {
  if (bytes < BYTES_PER_KB) {
    return `${String(bytes)} B`;
  }
  if (bytes < BYTES_PER_MB) {
    return `${String(Math.round(bytes / BYTES_PER_KB))} KB`;
  }
  return `${(bytes / BYTES_PER_MB).toFixed(1).replace('.', ',')} MB`;
}
