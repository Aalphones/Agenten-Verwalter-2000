import { invoke } from '@tauri-apps/api/core';
import type { ChangeScope } from '@/lib/bindings/ChangeScope';
import type { FileDiff } from '@/lib/bindings/FileDiff';
import type { SessionChanges } from '@/lib/bindings/SessionChanges';

/** Was der Agent in den Worktrees der Session gegenüber der Basis geändert hat, je Repository.
 *  Ein Repository, das nicht lesbar ist, trägt seinen Fehler in `error` — der Aufruf scheitert daran nicht.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound` */
export function loadChanges(sessionId: string): Promise<SessionChanges> {
  return invoke<SessionChanges>('changes_load', { sessionId });
}

/** Der Diff einer Datei im gewählten Blickwinkel; `position` ist das Repository in der Reihenfolge der Session.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound`, `internal` (ungültiger Pfad, unbekannte Position), `repositoryMissing`, `io` (Worktree fehlt), `git` */
export function loadFileDiff(
  sessionId: string,
  position: number,
  path: string,
  scope: ChangeScope,
): Promise<FileDiff> {
  return invoke<FileDiff>('changes_file_diff', { sessionId, position, path, scope });
}
