import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { AccountStatus } from '@/lib/bindings/AccountStatus';

const CODEX_ACCOUNT_CHANGED_EVENT = 'codex-account://changed';

/** Liest das Codex-Konto neu; kehrt erst nach der Antwort zurück (höchstens 20 s). */
export function loadCodexAccount(): Promise<AccountStatus> {
  return invoke<AccountStatus>('codex_account_load');
}

/** Startet die Anmeldung von Codex im Browser; kehrt sofort zurück.
 *  Anfang und Ende der Anmeldung kommen über `codex-account://changed`. */
export async function startCodexAccountLogin(): Promise<void> {
  await invoke('codex_account_login');
}

/** Meldet, wenn eine Anmeldung beginnt oder endet; danach `loadCodexAccount` neu laden. */
export function onCodexAccountChanged(callback: () => void): Promise<UnlistenFn> {
  return listen(CODEX_ACCOUNT_CHANGED_EVENT, (): void => {
    callback();
  });
}
