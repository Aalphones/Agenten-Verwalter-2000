import { invoke } from '@tauri-apps/api/core';
import { listen, type Event, type UnlistenFn } from '@tauri-apps/api/event';
import type { ContextChangedEvent } from '@/lib/bindings/ContextChangedEvent';
import type { SessionContext } from '@/lib/bindings/SessionContext';

const CONTEXT_CHANGED_EVENT = 'context://changed';

/** Die letzte Kontext-Aufschlüsselung der Session (Memory-Pfade mit `~`) und ob ihr Agent läuft.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound` */
export function loadContext(sessionId: string): Promise<SessionContext> {
  return invoke<SessionContext>('context_load', { sessionId });
}

/** Fragt den Agenten nach einer frischen Aufschlüsselung; die Antwort kommt als `context://changed`.
 *  `false`, wenn der Agent nicht zuhört.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound` */
export function refreshContext(sessionId: string): Promise<boolean> {
  return invoke<boolean>('context_refresh', { sessionId });
}

/** Meldet jede neue Aufschlüsselung einer Session; danach `loadContext` neu laden. */
export function onContextChanged(
  callback: (event: ContextChangedEvent) => void,
): Promise<UnlistenFn> {
  return listen<ContextChangedEvent>(CONTEXT_CHANGED_EVENT, (event: Event<ContextChangedEvent>) => {
    callback(event.payload);
  });
}
