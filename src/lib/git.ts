import { invoke } from '@tauri-apps/api/core';
import type { GitBranch } from '@/lib/bindings/GitBranch';
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
