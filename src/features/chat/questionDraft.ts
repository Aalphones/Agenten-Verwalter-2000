import type { ChatEntry } from '@/lib/bindings/ChatEntry';
import type { Question } from '@/lib/bindings/Question';
import type { QuestionAnswer } from '@/lib/bindings/QuestionAnswer';

export type QuestionEntry = Extract<ChatEntry, { kind: 'question' }>;

/** Gewählte Options-Labels je Frage, in Reihenfolge von `questions`. */
export type QuestionDraft = readonly (readonly string[])[];

export type PickResult =
  { kind: 'draft'; draft: QuestionDraft } | { kind: 'answer'; answer: QuestionAnswer };

const DENY_MESSAGE = 'Der Benutzer hat abgelehnt.';
const MULTI_SELECT_SEPARATOR = ', ';
const ALLOW_INDEX = 0;

export function emptyDraft(entry: QuestionEntry): QuestionDraft {
  return entry.questions.map((): readonly string[] => []);
}

/** Mit einer Mehrfachauswahl im Kasten sendet erst der Knopf „Antworten“, sonst der letzte fehlende Klick. */
export function needsSubmit(entry: QuestionEntry): boolean {
  return entry.questions.some((question: Question) => question.multiSelect);
}

export function isComplete(draft: QuestionDraft): boolean {
  return draft.length > 0 && draft.every((labels: readonly string[]) => labels.length > 0);
}

export function draftAnswer(draft: QuestionDraft): QuestionAnswer {
  return {
    kind: 'options',
    answers: draft.map((labels: readonly string[]) => labels.join(MULTI_SELECT_SEPARATOR)),
  };
}

/** Wählt eine Option. Eine Rechte-Abfrage ist mit dem ersten Klick beantwortet; eine Rückfrage, sobald jede Frage
 *  eine Antwort hat — außer der Kasten enthält eine Mehrfachauswahl. */
export function pickOption(
  entry: QuestionEntry,
  draft: QuestionDraft,
  questionIndex: number,
  optionIndex: number,
): PickResult | null {
  if (entry.questionKind === 'permission') {
    if (optionIndex === ALLOW_INDEX) {
      return { kind: 'answer', answer: { kind: 'allow' } };
    }
    return { kind: 'answer', answer: { kind: 'deny', message: DENY_MESSAGE } };
  }
  const question: Question | undefined = entry.questions[questionIndex];
  const label: string | undefined = question?.options[optionIndex]?.label;
  if (question === undefined || label === undefined) {
    return null;
  }
  const next: QuestionDraft = draft.map((labels: readonly string[], index: number) => {
    if (index !== questionIndex) {
      return labels;
    }
    if (!question.multiSelect) {
      return [label];
    }
    return labels.includes(label)
      ? labels.filter((selected: string) => selected !== label)
      : [...labels, label];
  });
  if (!needsSubmit(entry) && isComplete(next)) {
    return { kind: 'answer', answer: draftAnswer(next) };
  }
  return { kind: 'draft', draft: next };
}

/** Die Frage, auf die eine Ziffer-Taste wirkt: die erste ohne Auswahl, sonst die erste Mehrfachauswahl. */
export function digitQuestionIndex(entry: QuestionEntry, draft: QuestionDraft): number {
  const unanswered: number = draft.findIndex((labels: readonly string[]) => labels.length === 0);
  if (unanswered !== -1) {
    return unanswered;
  }
  return entry.questions.findIndex((question: Question) => question.multiSelect);
}
