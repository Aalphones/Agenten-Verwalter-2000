import { invoke } from '@tauri-apps/api/core';
import type { ChangeScope } from '@/lib/bindings/ChangeScope';
import type { FileDiff } from '@/lib/bindings/FileDiff';
import type { SessionChanges } from '@/lib/bindings/SessionChanges';

/** Was in den Repositories der Session und in ihren Ticket-Worktrees geändert ist — je Eintrag gegen seine Basis.
 *  Ein Eintrag, der nicht lesbar ist, trägt seinen Fehler in `error` — der Aufruf scheitert daran nicht.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound` */
export function loadChanges(sessionId: string): Promise<SessionChanges> {
  return invoke<SessionChanges>('changes_load', { sessionId });
}

/** Der Diff einer Datei im gewählten Blickwinkel; `key` ist der Eintrag aus `RepositoryChanges`.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound`, `internal` (ungültiger Pfad, Schlüssel oder Ordner), `repositoryMissing`, `io` (Worktree fehlt, gehört nicht zur Session oder gibt es nicht mehr), `git` */
export function loadFileDiff(
  sessionId: string,
  key: string,
  path: string,
  scope: ChangeScope,
): Promise<FileDiff> {
  return invoke<FileDiff>('changes_file_diff', { sessionId, key, path, scope });
}
