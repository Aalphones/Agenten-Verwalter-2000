import { invoke } from '@tauri-apps/api/core';
import type { GitBranch } from '@/lib/bindings/GitBranch';
import type { GitOpenTarget } from '@/lib/bindings/GitOpenTarget';
import type { GitSessionStatus } from '@/lib/bindings/GitSessionStatus';
import type { GitSwitchMode } from '@/lib/bindings/GitSwitchMode';

/** Der Git-Zustand aller Einträge der Changes einer Session, dazu die Sessions, die gerade arbeiten und
 *  damit Branch-Wechsel, Pull und Verwerfen sperren. Ein Eintrag, der nicht lesbar ist, trägt seinen
 *  Fehler in `error` — der Aufruf scheitert daran nicht.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound` */
export function loadGitStatus(sessionId: string): Promise<GitSessionStatus> {
  return invoke<GitSessionStatus>('git_status', { sessionId });
}

/** Lokale und Remote-Branches des Eintrags `key`.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound`, `internal` (ungültiger Schlüssel), `io`, `git` */
export function loadGitBranches(sessionId: string, key: string): Promise<GitBranch[]> {
  return invoke<GitBranch[]>('git_branches', { sessionId, key });
}

/** Committet genau die Pfade `paths`; der Commit zählt als Commit der Session. `push`: danach pushen — scheitert
 *  der Push, ist der Commit trotzdem angelegt. `amend`: letzten Commit ergänzen, nur solange er nicht gepusht ist.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound`, `internal`, `io`, `database`, `git` (auch leere Nachricht, keine Datei, gescheiterter Push) */
export async function gitCommit(
  sessionId: string,
  key: string,
  paths: readonly string[],
  message: string,
  push: boolean,
  amend: boolean,
): Promise<void> {
  await invoke('git_commit', { sessionId, key, paths, message, push, amend });
}

/** Pusht den Branch; ohne Upstream mit `-u` zum Remote.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound`, `internal`, `io`, `git` */
export async function gitPush(sessionId: string, key: string): Promise<void> {
  await invoke('git_push', { sessionId, key });
}

/** Holt und führt zusammen (Merge); gesperrt, solange eine Session des Vorhabens arbeitet.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound`, `internal`, `io`, `git` (auch `Gesperrt: …`) */
export async function gitPull(sessionId: string, key: string): Promise<void> {
  await invoke('git_pull', { sessionId, key });
}

/** Fragt den Remote ab, ändert nichts im Arbeitsordner.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound`, `internal`, `io`, `git` */
export async function gitFetch(sessionId: string, key: string): Promise<void> {
  await invoke('git_fetch', { sessionId, key });
}

/** Wechselt den Branch (`origin/x` legt den lokalen Branch an); `stash` legt offene Änderungen vorher beiseite.
 *  Gesperrt, solange eine Session des Vorhabens arbeitet.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound`, `internal`, `io`, `git` (auch `Gesperrt: …`) */
export async function gitSwitch(
  sessionId: string,
  key: string,
  branch: string,
  mode: GitSwitchMode,
): Promise<void> {
  await invoke('git_switch', { sessionId, key, branch, mode });
}

/** Legt einen Branch vom aktuellen `HEAD` an und wechselt darauf; gesperrt wie `gitSwitch`.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound`, `internal`, `io`, `git` (auch ungültiger Name, `Gesperrt: …`) */
export async function gitCreateBranch(sessionId: string, key: string, name: string): Promise<void> {
  await invoke('git_create_branch', { sessionId, key, name });
}

/** Bricht einen angehaltenen Merge oder Rebase ab; gesperrt wie `gitSwitch`.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound`, `internal`, `io`, `git` (auch `Gesperrt: …`) */
export async function gitAbortOperation(sessionId: string, key: string): Promise<void> {
  await invoke('git_abort_operation', { sessionId, key });
}

/** Setzt `path` auf den letzten Commit zurück; eine neue Datei wird gelöscht. Nicht rückgängig zu machen, gesperrt wie `gitSwitch`.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound`, `internal`, `io`, `git` (auch `Gesperrt: …`) */
export async function gitDiscard(sessionId: string, key: string, path: string): Promise<void> {
  await invoke('git_discard', { sessionId, key, path });
}

/** Legt alle Änderungen (auch neue Dateien) beiseite; gesperrt wie `gitSwitch`.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound`, `internal`, `io`, `git` (auch `Gesperrt: …`) */
export async function gitStashPush(sessionId: string, key: string): Promise<void> {
  await invoke('git_stash_push', { sessionId, key });
}

/** Die Stashes des Eintrags als Anzeigetext, neuester zuerst; die Stelle in der Liste ist der Index für `gitStashPop`.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound`, `internal`, `io`, `git` */
export function loadGitStashes(sessionId: string, key: string): Promise<string[]> {
  return invoke<string[]>('git_stash_list', { sessionId, key });
}

/** Holt den Stash an Stelle `index` zurück und entfernt ihn; gesperrt wie `gitSwitch`.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound`, `internal`, `io`, `git` (auch `Gesperrt: …`) */
export async function gitStashPop(sessionId: string, key: string, index: number): Promise<void> {
  await invoke('git_stash_pop', { sessionId, key, index });
}

/** Holt und setzt die eigenen Commits darauf (Rebase); ein angehaltener Rebase ist kein Fehler. Gesperrt wie `gitSwitch`.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound`, `internal`, `io`, `git` (auch `Gesperrt: …`) */
export async function gitPullRebase(sessionId: string, key: string): Promise<void> {
  await invoke('git_pull_rebase', { sessionId, key });
}

/** Führt `branch` (lokal oder `origin/x`) in den ausgecheckten Branch ein; ein Merge mit Konflikten ist kein Fehler. Gesperrt wie `gitSwitch`.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound`, `internal`, `io`, `git` (auch `Gesperrt: …`) */
export async function gitMerge(sessionId: string, key: string, branch: string): Promise<void> {
  await invoke('git_merge', { sessionId, key, branch });
}

/** Löscht den lokalen Branch; ohne `force` nur, wenn er gemergt ist.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound`, `internal`, `io`, `git` (`not-merged:<branch>`, wenn er nicht gemergt ist) */
export async function gitDeleteBranch(
  sessionId: string,
  key: string,
  branch: string,
  force: boolean,
): Promise<void> {
  await invoke('git_delete_branch', { sessionId, key, branch, force });
}

/** Legt neben dem Haupt-Checkout einen Ticket-Worktree mit neuem Branch `name` an; er erscheint danach als eigener Eintrag.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound`, `internal`, `io`, `git` (auch ungültiger Name, Ordner schon da, nicht am Haupt-Checkout) */
export async function gitCreateTicketWorktree(
  sessionId: string,
  key: string,
  name: string,
): Promise<void> {
  await invoke('git_create_ticket_worktree', { sessionId, key, name });
}

/** Öffnet den Ordner des Eintrags im Explorer oder in VS Code.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound`, `internal`, `io`, `git` (VS Code nicht gefunden) */
export async function gitOpen(
  sessionId: string,
  key: string,
  target: GitOpenTarget,
): Promise<void> {
  await invoke('git_open', { sessionId, key, target });
}
