import { invoke } from '@tauri-apps/api/core';
import type { DirEntry } from '@/lib/bindings/DirEntry';
import type { FileContent } from '@/lib/bindings/FileContent';
import type { FileDiff } from '@/lib/bindings/FileDiff';
import type { ProjectHistory } from '@/lib/bindings/ProjectHistory';
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

/** Die Fassung einer Datei im Arbeitsverzeichnis des Eintrags: Text oder nur ihr Zustand.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound`, `internal` (ungültiger Pfad, Schlüssel oder Ordner), `fileNotAllowed` (außerhalb des Repositorys), `io`, `git` */
export function readFile(sessionId: string, key: string, path: string): Promise<FileContent> {
  return invoke<FileContent>('files_read', { sessionId, key, path });
}

/** Der Verlauf des ganzen Vorhabens: je Session ihre eigenen Commits (Schritte) mit Dateien.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound`, `git` */
export function loadHistory(sessionId: string): Promise<ProjectHistory> {
  return invoke<ProjectHistory>('files_history', { sessionId });
}

/** Der Diff eines eigenen Commits an einer Datei gegen seinen ersten Elternteil (`key` aus `HistoryCommit`).
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound`, `internal` (kein eigener Commit des Vorhabens, ungültiger Pfad oder Schlüssel), `io`, `git` */
export function loadCommitDiff(
  sessionId: string,
  key: string,
  commit: string,
  path: string,
): Promise<FileDiff> {
  return invoke<FileDiff>('files_commit_diff', { sessionId, key, commit, path });
}
