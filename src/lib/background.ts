import { invoke } from '@tauri-apps/api/core';
import { listen, type Event, type UnlistenFn } from '@tauri-apps/api/event';
import type { BackgroundChangedEvent } from '@/lib/bindings/BackgroundChangedEvent';
import type { ScratchpadListing } from '@/lib/bindings/ScratchpadListing';
import type { SessionBackground } from '@/lib/bindings/SessionBackground';
import type { TextPreview } from '@/lib/bindings/TextPreview';

const BACKGROUND_CHANGED_EVENT = 'background://changed';

/** Befehle, Prozesse und Subagenten der Session ohne Ausgaben, dazu Claudes Scratchpad-Ordner.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound`, `database` */
export function loadBackground(sessionId: string): Promise<SessionBackground> {
  return invoke<SessionBackground>('background_load', { sessionId });
}

/** Ausgabe eines Befehls oder das Ende der Ausgabe eines Prozesses (höchstens 256 KiB).
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound`,
 *    `internal` (unbekannter Eintrag oder Subagent), `database` */
export function loadBackgroundOutput(sessionId: string, itemId: string): Promise<TextPreview> {
  return invoke<TextPreview>('background_output', { sessionId, itemId });
}

/** Bittet den Agenten, einen laufenden Prozess oder Subagenten zu beenden; der Zustand wechselt
 *  erst mit dessen Meldung (`background://changed`).
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound`,
 *    `internal` (Eintrag läuft nicht), `agentStopped` */
export async function stopBackgroundItem(sessionId: string, itemId: string): Promise<void> {
  await invoke('background_stop', { sessionId, itemId });
}

/** Der Scratchpad-Ordner als flache, nach Pfad sortierte Liste; leer, solange der Agent nie lief.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound` */
export function listScratchpad(sessionId: string): Promise<ScratchpadListing> {
  return invoke<ScratchpadListing>('scratchpad_list', { sessionId });
}

/** Anfang einer Scratchpad-Datei (höchstens 256 KiB); `path` relativ, mit `/`.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound`,
 *    `io` (ungültiger Pfad, Ordner, kein Scratchpad bekannt, nicht lesbar) */
export function readScratchpadFile(sessionId: string, path: string): Promise<TextPreview> {
  return invoke<TextPreview>('scratchpad_read', { sessionId, path });
}

/** Meldet jede Änderung an einem Hintergrund-Eintrag einer Session; danach `loadBackground` neu laden. */
export function onBackgroundChanged(
  callback: (event: BackgroundChangedEvent) => void,
): Promise<UnlistenFn> {
  return listen<BackgroundChangedEvent>(
    BACKGROUND_CHANGED_EVENT,
    (event: Event<BackgroundChangedEvent>) => {
      callback(event.payload);
    },
  );
}
