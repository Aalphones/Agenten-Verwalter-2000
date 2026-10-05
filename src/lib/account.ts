import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { AccountStatus } from '@/lib/bindings/AccountStatus';

const ACCOUNT_CHANGED_EVENT = 'account://changed';

/** Liest das Konto der Claude-Kommandozeile neu; kehrt erst nach der Antwort zurück (höchstens 15 s). */
export function loadAccount(): Promise<AccountStatus> {
  return invoke<AccountStatus>('account_load');
}

/** Startet `claude auth login` in einem eigenen Fenster; kehrt sofort zurück.
 *  Anfang und Ende der Anmeldung kommen über `account://changed`. */
export async function startAccountLogin(): Promise<void> {
  await invoke('account_login');
}

/** Meldet, wenn eine Anmeldung beginnt oder endet; danach `loadAccount` neu laden. */
export function onAccountChanged(callback: () => void): Promise<UnlistenFn> {
  return listen(ACCOUNT_CHANGED_EVENT, (): void => {
    callback();
  });
}
