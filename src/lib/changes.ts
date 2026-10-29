import { invoke } from '@tauri-apps/api/core';
import type { ChangeScope } from '@/lib/bindings/ChangeScope';
import type { ChangesReach } from '@/lib/bindings/ChangesReach';
import type { FileDiff } from '@/lib/bindings/FileDiff';
import type { FileLines } from '@/lib/bindings/FileLines';
import type { SessionChanges } from '@/lib/bindings/SessionChanges';

/** Was in den Repositories der Session und in ihren Ticket-Worktrees geändert ist — je Eintrag gegen seine Basis.
 *  `reach`: `session` nur die Session, `project` alle Sessions des Vorhabens (ADR 014).
 *  Ein Eintrag, der nicht lesbar ist, trägt seinen Fehler in `error` — der Aufruf scheitert daran nicht.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound` */
export function loadChanges(sessionId: string, reach: ChangesReach): Promise<SessionChanges> {
  return invoke<SessionChanges>('changes_load', { sessionId, reach });
}

/** Der Diff einer Datei im gewählten Blickwinkel; `key` ist der Eintrag aus `RepositoryChanges`.
 *  `reach`: `session` nur die Session, `project` alle Sessions des Vorhabens (ADR 014).
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound`, `internal` (ungültiger Pfad, Schlüssel oder Ordner, Datei ohne eigene Commits), `repositoryMissing`, `io` (Worktree fehlt, gehört nicht zur Session oder gibt es nicht mehr), `git` */
export function loadFileDiff(
  sessionId: string,
  reach: ChangesReach,
  key: string,
  path: string,
  scope: ChangeScope,
): Promise<FileDiff> {
  return invoke<FileDiff>('changes_file_diff', { sessionId, reach, key, path, scope });
}

/** Die Zeilen `from` bis `to` (1-basiert, einschließlich) der neuen Fassung einer Datei, für die unveränderten
 *  Stellen zwischen den Änderungen (ADR 043). Der Bereich wird an die Dateigröße gekürzt.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound`, `internal` (ungültiger Bereich, Pfad, Schlüssel oder Ordner, Datei ohne eigene Commits, kein Text), `repositoryMissing`, `io` (Worktree fehlt, gehört nicht zur Session oder gibt es nicht mehr), `git` */
export function loadFileLines(
  sessionId: string,
  reach: ChangesReach,
  key: string,
  path: string,
  scope: ChangeScope,
  from: number,
  to: number,
): Promise<FileLines> {
  return invoke<FileLines>('changes_file_lines', { sessionId, reach, key, path, scope, from, to });
}
