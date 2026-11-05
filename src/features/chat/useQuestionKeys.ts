import { useEffect, useEffectEvent } from 'react';
import {
  draftAnswer,
  isComplete,
  needsSubmit,
  type QuestionDraft,
  type QuestionEntry,
} from '@/features/chat/questionDraft';
import type { QuestionAnswering } from '@/features/chat/useQuestionAnswer';
import { isControlTarget, isTextTarget } from '@/lib/keyTargets';

const DIGIT_KEYS: readonly string[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
const ENTER_KEY = 'Enter';

/** Ziffern wählen in der aufgeklappten Frage, Enter sendet — für die eine offene Rückfrage, die die Ansicht gerade bedient. */
export function useQuestionKeys(entry: QuestionEntry | null, answering: QuestionAnswering): void {
  const handleDigit = useEffectEvent((event: KeyboardEvent): void => {
    if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey) {
      return;
    }
    if (isTextTarget(event.target) || entry === null) {
      return;
    }
    if (answering.isSending(entry)) {
      return;
    }
    const draft: QuestionDraft = answering.draftFor(entry);
    if (event.key === ENTER_KEY) {
      // Auf einem Knopf oder Link löst Enter dessen Klick aus, nicht das Senden.
      if (
        event.shiftKey ||
        isControlTarget(event.target) ||
        !needsSubmit(entry, draft) ||
        !isComplete(entry, draft)
      ) {
        return;
      }
      event.preventDefault();
      answering.submit(entry, draftAnswer(draft));
      return;
    }
    const optionIndex: number = DIGIT_KEYS.indexOf(event.key);
    if (optionIndex === -1) {
      return;
    }
    event.preventDefault();
    answering.pick(entry, draft.active, optionIndex);
  });

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      handleDigit(event);
    }
    window.addEventListener('keydown', handleKeyDown);
    return (): void => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
}
