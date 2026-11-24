import { invoke } from '@tauri-apps/api/core';
import { listen, type Event, type UnlistenFn } from '@tauri-apps/api/event';
import type { VaultQuery } from '@/lib/bindings/VaultQuery';
import type { VaultSearchResult } from '@/lib/bindings/VaultSearchResult';
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

/** Sucht im Vault für den Suchdialog; der Core begrenzt `limit` auf 1 bis 50.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `internal` mit einem Satz, wenn der Vault
 *    nicht eingerichtet, nicht erreichbar oder der Index nicht lesbar ist */
export function findInVault(query: VaultQuery): Promise<VaultSearchResult> {
  return invoke<VaultSearchResult>('vault_find', { query });
}

/** Öffnet eine eingelesene Datei oder einen Ordner mit dem Standardprogramm, mit `reveal` zeigt der
 *  Explorer den Eintrag. `path` ist relativ zum Vault.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `internal` (Pfad nicht eingelesen oder
 *    außerhalb des Vault), `io` */
export async function openVaultPath(path: string, reveal: boolean): Promise<void> {
  await invoke('vault_open', { path, reveal });
}

/** Ein eingelesenes Bild als `data:`-Adresse für die Vorschau.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `internal` (kein Bild, zu groß, nicht lesbar) */
export function loadVaultImage(path: string): Promise<string> {
  return invoke<string>('vault_preview', { path });
}
