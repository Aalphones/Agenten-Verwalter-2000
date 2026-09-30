import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { UsageStatus } from '@/lib/bindings/UsageStatus';

const USAGE_CHANGED_EVENT = 'usage://changed';

/** Der Zwischenspeicher des Kontingents, sofort. */
export function loadUsage(): Promise<UsageStatus> {
  return invoke<UsageStatus>('usage_load');
}

/** Startet einen Abruf im Hintergrund; das Ergebnis kommt über `usage://changed` und `loadUsage`.
 *  Ohne `force` tut der Core innerhalb von 30 s nach dem letzten Start nichts. */
export async function refreshUsage(force: boolean): Promise<void> {
  await invoke('usage_refresh', { force });
}

/** Meldet, wenn ein Abruf beginnt oder endet; danach `loadUsage` neu laden. */
export function onUsageChanged(callback: () => void): Promise<UnlistenFn> {
  return listen(USAGE_CHANGED_EVENT, (): void => {
    callback();
  });
}
