import { invoke } from '@tauri-apps/api/core';
import type { KnownRepository } from '@/lib/bindings/KnownRepository';

/** Alle bekannten Repositories, nach Name sortiert.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `database` */
export function listRepositories(): Promise<KnownRepository[]> {
  return invoke<KnownRepository[]>('repository_list');
}

/** Merkt sich das Repository, in dem der Ordner liegt; ein bekanntes wird zurückgegeben.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `folderNotAllowed`, `gitNotFound` */
export function addRepository(path: string): Promise<KnownRepository> {
  return invoke<KnownRepository>('repository_add', { path });
}

/** Entfernt das Repository aus der Liste; Sessions, die es nutzen, bleiben unberührt.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `database` */
export async function removeRepository(repositoryId: string): Promise<void> {
  await invoke('repository_remove', { repositoryId });
}
