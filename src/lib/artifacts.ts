import { invoke } from '@tauri-apps/api/core';
import type { ArtifactList } from '@/lib/bindings/ArtifactList';

/** Adresse einer Seite auf dem Artefakt-Server; `?v=` zwingt das iframe zum Neuladen, sobald die Datei sich ändert. */
export function artifactUrl(baseUrl: string, file: string, modifiedAt: number): string {
  const path: string = file.split('/').map(encodeURIComponent).join('/');
  return `${baseUrl}${path}?v=${String(modifiedAt)}`;
}

/** Artefakte des Vorhabens, zu dem die Session gehört.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound` */
export async function listArtifacts(sessionId: string): Promise<ArtifactList> {
  return invoke<ArtifactList>('artifacts_list', { sessionId });
}

/** Öffnet das Artefakt mit dem Standardprogramm.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound`, `fileNotFound`,
 *    `fileNotAllowed` (kein Artefakt), `io` (Öffnen gescheitert) */
export async function openArtifactInBrowser(sessionId: string, file: string): Promise<void> {
  await invoke('artifact_open_in_browser', { sessionId, file });
}
