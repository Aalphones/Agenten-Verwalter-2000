import type { ChatEntry } from '@/lib/bindings/ChatEntry';
import type { Question } from '@/lib/bindings/Question';
import type { QuestionAnswer } from '@/lib/bindings/QuestionAnswer';
import type { QuestionOption } from '@/lib/bindings/QuestionOption';

export type QuestionEntry = Extract<ChatEntry, { kind: 'question' }>;

export interface QuestionDraft {
  /** Gewählte Options-Namen (ohne „Empfohlen“-Zusatz) je Frage, in Wahlreihenfolge. */
  readonly labels: readonly (readonly string[])[];
  /** Index der aufgeklappten Frage; Ziffern wirken hier. */
  readonly active: number;
  /** Je Frage: Name → Notiz. Ein vorhandener Schlüssel heißt „Feld offen“, auch mit leerem Text. */
  readonly notes: readonly Readonly<Record<string, string>>[];
  /** Je Frage: eigene Antwort, `null` = Feld zu. */
  readonly custom: readonly (string | null)[];
}

export type PickResult =
  { kind: 'draft'; draft: QuestionDraft } | { kind: 'answer'; answer: QuestionAnswer };

export interface OptionName {
  name: string;
  recommended: boolean;
}

const DENY_MESSAGE = 'Der Benutzer hat abgelehnt.';
const MULTI_SELECT_SEPARATOR = ', ';
const ALLOW_INDEX = 0;
/** Claude markiert eine empfohlene Option mit einem Zusatz am Ende des Labels. */
const RECOMMENDED_SUFFIX = /\s*\((recommended|empfohlen)\)\s*$/i;

export function emptyDraft(entry: QuestionEntry): QuestionDraft {
  return {
    labels: entry.questions.map((): readonly string[] => []),
    active: 0,
    notes: entry.questions.map((): Readonly<Record<string, string>> => ({})),
    custom: entry.questions.map((): string | null => null),
  };
}

export function optionName(label: string): OptionName {
  const name: string = label.replace(RECOMMENDED_SUFFIX, '');
  return { name, recommended: name !== label };
}

/** Claudes Kurzname der Frage; Rechte-Abfragen und ältere Verläufe haben keinen. */
export function questionHeader(question: Question, index: number): string {
  if (question.header !== '') {
    return question.header;
  }
  return `Frage ${String(index + 1)}`;
}

export function isAnswered(draft: QuestionDraft, questionIndex: number): boolean {
  return (draft.labels[questionIndex]?.length ?? 0) > 0;
}

export function isComplete(entry: QuestionEntry, draft: QuestionDraft): boolean {
  return (
    entry.questions.length > 0 &&
    entry.questions.every((_question: Question, index: number) => isAnswered(draft, index))
  );
}

/** Ab zwei Fragen oder mit einer Mehrfachauswahl sendet erst „Antworten“ bzw. Enter, sonst der Klick. */
export function needsSubmit(entry: QuestionEntry): boolean {
  return (
    entry.questions.length > 1 || entry.questions.some((question: Question) => question.multiSelect)
  );
}

export function setActive(draft: QuestionDraft, questionIndex: number): QuestionDraft {
  return { ...draft, active: questionIndex };
}

/** Die nächste unbeantwortete Frage hinter `from`, ringsum gesucht; gibt es keine, bleibt es `from`. */
export function nextActive(entry: QuestionEntry, draft: QuestionDraft, from: number): number {
  const count: number = entry.questions.length;
  for (let step = 1; step < count; step += 1) {
    const candidate: number = (from + step) % count;
    if (!isAnswered(draft, candidate)) {
      return candidate;
    }
  }
  return from;
}

/** Antwortteil einer Frage, wie er gesendet und in der zugeklappten Zeile gezeigt wird. */
export function draftAnswerPart(draft: QuestionDraft, questionIndex: number): string {
  return (draft.labels[questionIndex] ?? []).join(MULTI_SELECT_SEPARATOR);
}

export function draftAnswer(draft: QuestionDraft): QuestionAnswer {
  return {
    kind: 'options',
    answers: draft.labels.map((_labels: readonly string[], index: number) =>
      draftAnswerPart(draft, index),
    ),
  };
}

/** Wählt eine Option. Eine Rechte-Abfrage ist mit dem ersten Klick beantwortet; eine Rückfrage sendet der Klick
 *  nur, wenn sie keinen Knopf braucht (`needsSubmit`) und danach jede Frage eine Antwort hat. */
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
  const name: string = optionName(label).name;
  const labels: readonly (readonly string[])[] = draft.labels.map(
    (selected: readonly string[], index: number) => {
      if (index !== questionIndex) {
        return selected;
      }
      if (!question.multiSelect) {
        return [name];
      }
      return selected.includes(name)
        ? selected.filter((candidate: string) => candidate !== name)
        : [...selected, name];
    },
  );
  const picked: QuestionDraft = { ...draft, labels };
  const next: QuestionDraft = question.multiSelect
    ? picked
    : setActive(picked, nextActive(entry, picked, questionIndex));
  if (!needsSubmit(entry) && isComplete(entry, next)) {
    return { kind: 'answer', answer: draftAnswer(next) };
  }
  return { kind: 'draft', draft: next };
}

/** Trennt die Antworten mehrerer Fragen im gespeicherten Antworttext (Gegenstück zu `ANSWER_SEPARATOR` im Core). */
const ANSWER_SEPARATOR = ' · ';

/** Der gespeicherte Antworttext je Frage; `null`, wenn er sich nicht den Fragen zuordnen lässt (z. B. Freitext). */
export function answerParts(entry: QuestionEntry): readonly string[] | null {
  if (entry.answer === null) {
    return null;
  }
  const parts: string[] = entry.answer.split(ANSWER_SEPARATOR);
  if (parts.length !== entry.questions.length) {
    return null;
  }
  return parts;
}

/** Die Options-Namen, die ein gespeicherter Antworttext für eine Frage gewählt hat. Freitext trifft keinen. */
export function answeredLabels(entry: QuestionEntry, questionIndex: number): readonly string[] {
  if (entry.answer === null) {
    return [];
  }
  const part: string | undefined = answerParts(entry)?.[questionIndex] ?? entry.answer;
  const chosen: readonly string[] = part
    .split(MULTI_SELECT_SEPARATOR)
    .map((piece: string) => optionName(piece).name);
  const whole: string = optionName(part).name;
  const names: readonly string[] =
    entry.questions[questionIndex]?.options.map(
      (option: QuestionOption) => optionName(option.label).name,
    ) ?? [];
  return names.filter((name: string) => name === whole || chosen.includes(name));
}
