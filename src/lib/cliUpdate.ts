import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { CliVersionStatus } from '@/lib/bindings/CliVersionStatus';

const CLI_UPDATE_CHANGED_EVENT = 'cli-update://changed';

/** Liest installierte und jüngste Version der Claude-Kommandozeile neu; kehrt erst nach der Antwort
 *  zurück (höchstens 15 s). */
export function loadCliVersion(): Promise<CliVersionStatus> {
  return invoke<CliVersionStatus>('cli_update_load');
}

/** Startet `claude update`; kehrt sofort zurück. Anfang und Ende kommen über `cli-update://changed`. */
export async function startCliUpdate(): Promise<void> {
  await invoke('cli_update_run');
}

/** Meldet, wenn eine Aktualisierung beginnt oder endet; danach `loadCliVersion` neu laden. */
export function onCliUpdateChanged(callback: () => void): Promise<UnlistenFn> {
  return listen(CLI_UPDATE_CHANGED_EVENT, (): void => {
    callback();
  });
}
