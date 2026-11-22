import { formatClock } from '@/features/context/formatTokens';
import type { VaultStatus } from '@/lib/bindings/VaultStatus';

/** Der Satz der Statuszeile. */
export function statusText(status: VaultStatus): string {
  switch (status.state) {
    case 'off':
      return 'aus';
    case 'missing':
    case 'error':
      return status.message ?? 'Der Vault ist nicht erreichbar.';
    case 'scanning':
      return 'wird eingelesen …';
    case 'ready':
      return readyText(status);
  }
}

function readyText(status: VaultStatus): string {
  if (status.scannedAt === null) {
    return 'bereit · noch nicht eingelesen';
  }
  const base = `bereit · ${String(status.files)} Dateien · ${String(status.artifacts)} Artefakte · Stand ${formatClock(Number(status.scannedAt))}`;
  if (status.skipped > 0) {
    return `${base} · ${String(status.skipped)} übersprungen`;
  }
  return base;
}
