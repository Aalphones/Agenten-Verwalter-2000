import type { VoiceModelState } from '@/lib/bindings/VoiceModelState';

export type DownloadingState = Extract<VoiceModelState, { kind: 'downloading' }>;

const BYTES_PER_MEGABYTE = 1_000_000;
const megabyteFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });

/** Fortschritt in ganzen Prozent; ohne bekannte Gesamtgröße 0. */
export function downloadPercent(state: DownloadingState): number {
  if (state.totalBytes <= 0) {
    return 0;
  }
  return Math.min(100, Math.round((state.receivedBytes / state.totalBytes) * 100));
}

/** Bytes als ganze Megabyte (1 MB = 1 000 000 Bytes), wie es der Anbieter des Modells angibt. */
export function formatMegabytes(bytes: number): string {
  return megabyteFormat.format(bytes / BYTES_PER_MEGABYTE);
}
