import { invoke } from '@tauri-apps/api/core';
import type { DirEntry } from '@/lib/bindings/DirEntry';
import type { FileContent } from '@/lib/bindings/FileContent';
import type { RepoTree } from '@/lib/bindings/RepoTree';

/** Der vollständige Dateibaum eines Eintrags (`key` aus `RepositoryChanges`, aufgelöst über das ganze Vorhaben):
 *  versionierte und neue Dateien, dazu die von Git ignorierten Einträge ohne innere Repositories (ADR 067).
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound`, `internal` (ungültiger Schlüssel oder Ordner), `io` (Eintrag gibt es nicht mehr), `git` */
export function loadRepoTree(sessionId: string, key: string): Promise<RepoTree> {
  return invoke<RepoTree>('files_tree', { sessionId, key });
}

/** Die direkten Kinder eines ignorierten Ordners im Eintrag, Ordner zuerst.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound`, `internal` (ungültiger Pfad, Schlüssel oder Ordner), `fileNotAllowed` (außerhalb des Repositorys oder nicht ignoriert), `io`, `git` */
export function loadIgnoredChildren(
  sessionId: string,
  key: string,
  path: string,
): Promise<DirEntry[]> {
  return invoke<DirEntry[]>('files_ignored_children', { sessionId, key, path });
}

/** Die Fassung einer Datei im Arbeitsverzeichnis des Eintrags: Text, Bild oder nur ihr Zustand.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound`, `internal` (ungültiger Pfad, Schlüssel oder Ordner), `fileNotAllowed` (außerhalb des Repositorys), `io`, `git` */
export function readFile(sessionId: string, key: string, path: string): Promise<FileContent> {
  return invoke<FileContent>('files_read', { sessionId, key, path });
}
