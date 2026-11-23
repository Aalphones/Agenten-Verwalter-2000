import { invoke } from '@tauri-apps/api/core';
import { listen, type Event, type UnlistenFn } from '@tauri-apps/api/event';
import type { VaultStatus } from '@/lib/bindings/VaultStatus';

const VAULT_CHANGED_EVENT = 'vault://changed';

/** Stand des Developer Vault; schreibt nichts.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} */
export function loadVaultStatus(): Promise<VaultStatus> {
  return invoke<VaultStatus>('vault_status');
}

/** Schreibt README.md, AGENTS.md und inbox/ in den leeren Vault-Ordner und gibt den neuen Stand zurück.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `internal` (Vault nicht bereit oder
 *    Ordner nicht leer), `io` */
export function createVaultSkeleton(): Promise<VaultStatus> {
  return invoke<VaultStatus>('vault_create_skeleton');
}

/** Stößt den Abgleich im Hintergrund an und kehrt sofort zurück; den Verlauf meldet `onVaultChanged`.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} */
export async function rescanVault(): Promise<void> {
  await invoke('vault_rescan');
}

/** Meldet jeden Zustandswechsel des Vault. */
export function onVaultChanged(callback: (status: VaultStatus) => void): Promise<UnlistenFn> {
  return listen<VaultStatus>(VAULT_CHANGED_EVENT, (event: Event<VaultStatus>) => {
    callback(event.payload);
  });
}
