import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { AppUpdateProgress } from '@/lib/bindings/AppUpdateProgress';
import type { AppUpdateStatus } from '@/lib/bindings/AppUpdateStatus';

const APP_UPDATE_PROGRESS_EVENT = 'app-update://progress';

/** Fragt die GitHub-Releases ab; kehrt erst nach der Antwort zurück (höchstens 10 s). Ein
 *  Abfragefehler steht im Ergebnis (`latestError`), nicht in der Zurückweisung. */
export function loadAppUpdate(): Promise<AppUpdateStatus> {
  return invoke<AppUpdateStatus>('app_update_load');
}

/** Lädt die neueste Version, prüft sie und ersetzt den Verwalter. Bei Erfolg endet die App, bevor
 *  das Versprechen zurückkehrt; es wird nur bei einem Fehler zurückgewiesen. */
export async function installAppUpdate(): Promise<void> {
  await invoke('app_update_install');
}

/** Meldet den Fortschritt einer laufenden Installation. */
export function onAppUpdateProgress(
  callback: (progress: AppUpdateProgress) => void,
): Promise<UnlistenFn> {
  return listen<AppUpdateProgress>(APP_UPDATE_PROGRESS_EVENT, (event): void => {
    callback(event.payload);
  });
}
