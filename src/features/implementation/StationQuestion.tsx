import { useMemo, type ReactElement } from 'react';
import { SessionActionError } from '@/app/SessionActionError';
import { QuestionBlock } from '@/features/chat/QuestionBlock';
import type { QuestionDraft, QuestionEntry } from '@/features/chat/questionDraft';
import { useQuestionAnswer, type QuestionAnswering } from '@/features/chat/useQuestionAnswer';
import { useQuestionKeys } from '@/features/chat/useQuestionKeys';
import type { OpenQuestion } from '@/lib/bindings/OpenQuestion';
import type { QuestionAnswer } from '@/lib/bindings/QuestionAnswer';

interface StationQuestionProps {
  sessionId: string;
  openQuestion: OpenQuestion;
}

/** Rückfrage-Kasten auf der Karte einer Station; antwortet über denselben Baustein wie der Chat (ADR 055). */
export function StationQuestion({ sessionId, openQuestion }: StationQuestionProps): ReactElement {
  const entry: QuestionEntry = useMemo(
    (): QuestionEntry => ({
      kind: 'question',
      seq: openQuestion.seq,
      requestId: openQuestion.requestId,
      questionKind: openQuestion.questionKind,
      questions: openQuestion.questions,
      answer: null,
    }),
    [openQuestion],
  );
  const answering: QuestionAnswering = useQuestionAnswer(sessionId);
  useQuestionKeys(entry, answering);

  return (
    <>
      <QuestionBlock
        entry={entry}
        draft={answering.draftFor(entry)}
        isSending={answering.isSending(entry)}
        showsComposerHint={false}
        onPick={(questionIndex: number, optionIndex: number): void => {
          answering.pick(entry, questionIndex, optionIndex);
        }}
        onSubmit={(answer: QuestionAnswer): void => {
          answering.submit(entry, answer);
        }}
        onDraft={(next: QuestionDraft): void => {
          answering.storeDraft(entry, next);
        }}
      />
      <SessionActionError sessionId={sessionId} />
    </>
  );
}
