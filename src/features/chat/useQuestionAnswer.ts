import { useState } from 'react';
import {
  emptyDraft,
  pickOption,
  type PickResult,
  type QuestionDraft,
  type QuestionEntry,
} from '@/features/chat/questionDraft';
import type { QuestionAnswer } from '@/lib/bindings/QuestionAnswer';
import { answerQuestion } from '@/lib/chat';
import { commandErrorText } from '@/lib/errors';
import { useChatStore } from '@/stores/chat';
import { useSessionErrorsStore } from '@/stores/sessionErrors';

export interface QuestionAnswering {
  draftFor: (entry: QuestionEntry) => QuestionDraft;
  isSending: (entry: QuestionEntry) => boolean;
  pick: (entry: QuestionEntry, questionIndex: number, optionIndex: number) => void;
  submit: (entry: QuestionEntry, answer: QuestionAnswer) => void;
  storeDraft: (entry: QuestionEntry, draft: QuestionDraft) => void;
}

/** Der Antwortweg auf Rückfragen einer Session: Entwurf, Senden, Fehlerzeile. Chat und Karte der Umsetzung benutzen ihn gemeinsam. */
export function useQuestionAnswer(sessionId: string): QuestionAnswering {
  const [sending, setSending] = useState<ReadonlySet<string>>(() => new Set<string>());
  // Anfragen, die hier erfolgreich beantwortet wurden: der Kasten bleibt gesperrt, bis die Ansicht sie nicht mehr meldet.
  const [sent, setSent] = useState<ReadonlySet<string>>(() => new Set<string>());
  // Den Rückfall (`emptyDraft`) erst außerhalb: ein Selektor mit neuem Objekt je Aufruf löst in Zustand v5 eine Endlosschleife aus.
  const drafts: Record<string, QuestionDraft> | undefined = useChatStore(
    (state) => state.questionDrafts[sessionId],
  );
  const setQuestionDraft = useChatStore((state) => state.setQuestionDraft);
  const clearQuestionDraft = useChatStore((state) => state.clearQuestionDraft);
  const reportSessionError = useSessionErrorsStore((state) => state.report);
  const clearSessionError = useSessionErrorsStore((state) => state.clear);

  function draftFor(entry: QuestionEntry): QuestionDraft {
    return drafts?.[entry.requestId] ?? emptyDraft(entry);
  }

  function isSending(entry: QuestionEntry): boolean {
    return sending.has(entry.requestId) || sent.has(entry.requestId);
  }

  function storeDraft(entry: QuestionEntry, draft: QuestionDraft): void {
    setQuestionDraft(sessionId, entry.requestId, draft);
  }

  function submit(entry: QuestionEntry, answer: QuestionAnswer): void {
    const requestId: string = entry.requestId;
    setSending((current: ReadonlySet<string>) => new Set<string>(current).add(requestId));
    answerQuestion(sessionId, requestId, answer)
      .then(() => {
        setSent((current: ReadonlySet<string>) => new Set<string>(current).add(requestId));
        clearQuestionDraft(sessionId, requestId);
        clearSessionError(sessionId);
      })
      .catch((reason: unknown) => {
        console.error('Rückfrage nicht beantwortbar', reason);
        reportSessionError(sessionId, `Antwort nicht gesendet: ${commandErrorText(reason)}`);
      })
      .finally(() => {
        setSending((current: ReadonlySet<string>) => {
          const next = new Set<string>(current);
          next.delete(requestId);
          return next;
        });
      });
  }

  function pick(entry: QuestionEntry, questionIndex: number, optionIndex: number): void {
    const result: PickResult | null = pickOption(
      entry,
      draftFor(entry),
      questionIndex,
      optionIndex,
    );
    if (result === null) {
      return;
    }
    if (result.kind === 'answer') {
      submit(entry, result.answer);
      return;
    }
    storeDraft(entry, result.draft);
  }

  return { draftFor, isSending, pick, submit, storeDraft };
}
