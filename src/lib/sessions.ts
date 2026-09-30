import { invoke } from '@tauri-apps/api/core';
import { listen, type Event, type UnlistenFn } from '@tauri-apps/api/event';
import type { Effort } from '@/lib/bindings/Effort';
import type { Mode } from '@/lib/bindings/Mode';
import type { ModelId } from '@/lib/bindings/ModelId';
import type { SessionSummary } from '@/lib/bindings/SessionSummary';

const SESSION_CHANGED_EVENT = 'session://changed';

/** Legt eine Session an — liest die Basis jedes Repositorys, legt keine Worktrees an —, startet den Agenten
 *  und schickt die Aufgabe samt Anhängen als erste Nachricht. Scheitert ein Schritt, bleibt nichts zurück.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `claudeNotFound`, `io`,
 *    `repositoryMissing`, `git`, `gitNotFound` */
export function createSession(
  task: string,
  attachmentIds: string[],
  repositoryIds: string[],
  model: ModelId,
  effort: Effort,
  mode: Mode,
): Promise<SessionSummary> {
  return invoke<SessionSummary>('session_create', {
    task,
    attachmentIds,
    repositoryIds,
    model,
    effort,
    mode,
  });
}

/** Alle Sessions, neueste zuerst.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} wenn der Core ablehnt */
export function listSessions(): Promise<SessionSummary[]> {
  return invoke<SessionSummary[]>('session_list');
}

/** Unterbricht die laufende Antwort; die Session wechselt auf „Pausiert“.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound`, `agentStopped` */
export async function pauseSession(sessionId: string): Promise<void> {
  await invoke('session_pause', { sessionId });
}

/** Setzt eine pausierte Session mit „Mach weiter.“ fort.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound`, `agentStopped` */
export async function resumeSession(sessionId: string): Promise<void> {
  await invoke('session_resume', { sessionId });
}

/** Beendet die Session endgültig.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound` */
export async function cancelSession(sessionId: string): Promise<void> {
  await invoke('session_cancel', { sessionId });
}

/** Ändert den Namen der Session (höchstens 60 Zeichen, leer ist ein Fehler).
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound`, `internal` (leerer Name) */
export async function renameSession(sessionId: string, name: string): Promise<void> {
  await invoke('session_rename', { sessionId, name });
}

/** Beendet den Agenten der Session und nimmt sie aus der Liste; der Verlauf bleibt, Repositories und Worktrees bleiben unberührt (bei Sessions vor ADR 010 räumt der Core saubere App-Worktrees weg).
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound` */
export async function archiveSession(sessionId: string): Promise<void> {
  await invoke('session_archive', { sessionId });
}

/** Startet den Agenten einer Session im Status „Fehler“ mit vollem Verlauf neu; danach „Pausiert“.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound`, `claudeNotFound`, `io` */
export async function restartSession(sessionId: string): Promise<void> {
  await invoke('session_restart', { sessionId });
}

/** Wirkt sofort.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound`, `agentStopped` */
export async function setSessionModel(sessionId: string, model: ModelId): Promise<void> {
  await invoke('session_set_model', { sessionId, model });
}

/** Wirkt sofort.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound`, `agentStopped` */
export async function setSessionMode(sessionId: string, mode: Mode): Promise<void> {
  await invoke('session_set_mode', { sessionId, mode });
}

/** Wirkt mit der nächsten gesendeten Nachricht (der Agent wird dafür neu gestartet).
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound` */
export async function setSessionEffort(sessionId: string, effort: Effort): Promise<void> {
  await invoke('session_set_effort', { sessionId, effort });
}

/** Die letzten Zeilen der Fehlerausgabe und unverstandene Zeilen des Agenten (höchstens 300).
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound` */
export function getSessionLog(sessionId: string): Promise<string[]> {
  return invoke<string[]>('session_log', { sessionId });
}

/** Meldet jede Änderung an Status, Modell, Modus, Denkaufwand, Kontext und Laufzeit. */
export function onSessionChanged(callback: (summary: SessionSummary) => void): Promise<UnlistenFn> {
  return listen<SessionSummary>(SESSION_CHANGED_EVENT, (event: Event<SessionSummary>) => {
    callback(event.payload);
  });
}
