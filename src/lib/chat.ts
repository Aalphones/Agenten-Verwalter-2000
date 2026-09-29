import { invoke } from '@tauri-apps/api/core';
import { listen, type Event, type UnlistenFn } from '@tauri-apps/api/event';
import type { ChatEntryEvent } from '@/lib/bindings/ChatEntryEvent';
import type { ChatPage } from '@/lib/bindings/ChatPage';
import type { QuestionAnswer } from '@/lib/bindings/QuestionAnswer';

const CHAT_ENTRY_EVENT = 'chat://entry';

/** Liest eine Seite des Verlaufs: die `limit` Einträge direkt vor `before` (`null` = ab dem Ende), aufsteigend.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound` */
export function getChatHistory(
  sessionId: string,
  before: number | null,
  limit: number,
): Promise<ChatPage> {
  return invoke<ChatPage>('chat_history', { sessionId, before, limit });
}

/** Schickt eine Nachricht; ist eine Rückfrage offen, beantwortet sie die älteste. Die Anhänge wandern
 *  dabei aus dem Zwischenordner in den Workspace der Session.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound`, `sessionClosed`,
 *    `agentStopped`, `attachmentsWhileWaiting`, `io` (Anhang fehlt oder ungültige ID) */
export async function sendMessage(
  sessionId: string,
  text: string,
  attachmentIds: string[],
): Promise<void> {
  await invoke('chat_send', { sessionId, text, attachmentIds });
}

/** Beantwortet eine Rückfrage oder Rechte-Abfrage.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound`, `agentStopped`, `internal` (Anfrage nicht offen) */
export async function answerQuestion(
  sessionId: string,
  requestId: string,
  answer: QuestionAnswer,
): Promise<void> {
  await invoke('chat_answer', { sessionId, requestId, answer });
}

/** Meldet jeden neuen oder geänderten Chat-Eintrag; ein geänderter behält seine `seq`. */
export function onChatEntry(
  callback: (chatEntryEvent: ChatEntryEvent) => void,
): Promise<UnlistenFn> {
  return listen<ChatEntryEvent>(CHAT_ENTRY_EVENT, (event: Event<ChatEntryEvent>) => {
    callback(event.payload);
  });
}
