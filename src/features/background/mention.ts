import { useChatStore } from '@/stores/chat';
import { useSessionsStore } from '@/stores/sessions';

const COMPOSER_INPUT_ID = 'composer-input';

/** Wechselt zum Chat und hängt „Zu <label>: “ an den Entwurf an; der Fokus steht danach im Textfeld. */
export function mentionInChat(sessionId: string, label: string): void {
  const draft: string = useChatStore.getState().drafts[sessionId] ?? '';
  const separator: string = draft === '' || /\s$/.test(draft) ? '' : ' ';
  useSessionsStore.getState().showView('chat');
  useChatStore.getState().setDraft(sessionId, `${draft}${separator}Zu ${label}: `);
  // Der Chat wird beim Wechsel aus den Changes neu gemountet — das Textfeld gibt es erst im nächsten Frame.
  window.requestAnimationFrame(() => {
    document.getElementById(COMPOSER_INPUT_ID)?.focus();
  });
}
