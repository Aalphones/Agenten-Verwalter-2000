import type { ReactElement } from 'react';
import { StatusIcon } from '@/components/StatusIcon';
import {
  draftAnswer,
  isComplete,
  needsSubmit,
  type QuestionDraft,
  type QuestionEntry,
} from '@/features/chat/questionDraft';
import type { Question } from '@/lib/bindings/Question';
import type { QuestionAnswer } from '@/lib/bindings/QuestionAnswer';
import type { QuestionOption } from '@/lib/bindings/QuestionOption';
import './QuestionBlock.css';

interface QuestionBlockProps {
  entry: QuestionEntry;
  draft: QuestionDraft;
  isSending: boolean;
  onPick: (questionIndex: number, optionIndex: number) => void;
  onSubmit: (answer: QuestionAnswer) => void;
}

export function QuestionBlock({
  entry,
  draft,
  isSending,
  onPick,
  onSubmit,
}: QuestionBlockProps): ReactElement {
  const isAnswered: boolean = entry.answer !== null;
  const isLocked: boolean = isAnswered || isSending;

  function renderQuestion(question: Question, questionIndex: number): ReactElement {
    const selected: readonly string[] = draft[questionIndex] ?? [];
    return (
      <div key={questionIndex} className="question-block__question">
        <p className="question-block__text">{question.question}</p>
        <div className="question-block__options">
          {question.options.map((option: QuestionOption, optionIndex: number) => (
            <button
              key={option.label}
              type="button"
              className={`question-block__option${
                selected.includes(option.label) ? ' question-block__option--selected' : ''
              }`}
              aria-pressed={question.multiSelect ? selected.includes(option.label) : undefined}
              disabled={isLocked}
              onClick={(): void => {
                onPick(questionIndex, optionIndex);
              }}
            >
              <span className="question-block__key">{String(optionIndex + 1)}</span>
              <span className="question-block__label">
                <span className="question-block__option-name">{option.label}</span>
                {option.hint !== '' && <span className="question-block__hint">{option.hint}</span>}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  function renderFooter(): ReactElement {
    if (entry.answer !== null) {
      return <div className="question-block__footer">Antwort: {entry.answer}</div>;
    }
    if (needsSubmit(entry)) {
      return (
        <div className="question-block__submit-row">
          <button
            type="button"
            className="question-block__submit"
            disabled={isLocked || !isComplete(draft)}
            onClick={(): void => {
              onSubmit(draftAnswer(draft));
            }}
          >
            Antworten
          </button>
          <span className="question-block__footer">Oder schreib unten eine eigene Antwort.</span>
        </div>
      );
    }
    return <div className="question-block__footer">Oder schreib unten eine eigene Antwort.</div>;
  }

  return (
    <div
      className={`question-block${isAnswered ? ' question-block--answered' : ''}`}
      role="group"
      aria-label="Rückfrage des Agenten"
    >
      <div className="question-block__head">
        <StatusIcon status={isAnswered ? 'completed' : 'waiting'} size={12} />
        <span>{isAnswered ? 'Claude hat gefragt' : 'Claude wartet auf deine Entscheidung'}</span>
      </div>
      {entry.questions.map(renderQuestion)}
      {renderFooter()}
    </div>
  );
}
