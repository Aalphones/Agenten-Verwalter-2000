import type { ReactElement } from 'react';
import { optionName, questionHeader, type OptionName } from '@/features/chat/questionDraft';
import type { Question } from '@/lib/bindings/Question';
import type { QuestionOption } from '@/lib/bindings/QuestionOption';

interface QuestionItemProps {
  question: Question;
  questionIndex: number;
  questionCount: number;
  /** Gewählte Options-Namen ohne „Empfohlen“-Zusatz. */
  selected: readonly string[];
  /** Die aktive Frage zeigt die Ziffern; nur auf sie wirken die Tasten. */
  isActive: boolean;
  /** Schreibgeschützt: beantwortet oder während des Sendens. */
  isLocked: boolean;
  onPick: (optionIndex: number) => void;
}

/** Eine aufgeklappte Frage einer Rückfrage. */
export function QuestionItem({
  question,
  questionIndex,
  questionCount,
  selected,
  isActive,
  isLocked,
  onPick,
}: QuestionItemProps): ReactElement {
  const header: string = questionHeader(question, questionIndex);
  const showsKeys: boolean = isActive && !isLocked;

  function renderOption(option: QuestionOption, optionIndex: number): ReactElement {
    const { name, recommended }: OptionName = optionName(option.label);
    const isSelected: boolean = selected.includes(name);
    return (
      <button
        key={option.label}
        type="button"
        className={`question-block__choice${isSelected ? ' question-block__choice--selected' : ''}`}
        role={question.multiSelect ? 'checkbox' : 'radio'}
        aria-checked={isSelected}
        disabled={isLocked}
        onClick={(): void => {
          onPick(optionIndex);
        }}
      >
        <span
          className={`question-block__marker question-block__marker--${
            question.multiSelect ? 'check' : 'radio'
          }`}
          aria-hidden="true"
        />
        <span className="question-block__choice-text">
          <span className="question-block__choice-name">
            {name}
            {recommended && <span className="question-block__badge">Empfohlen</span>}
          </span>
          {option.hint !== '' && <span className="question-block__hint">{option.hint}</span>}
        </span>
        {showsKeys && <kbd className="question-block__kbd">{String(optionIndex + 1)}</kbd>}
      </button>
    );
  }

  return (
    <section
      className={`question-block__question${isActive ? ' question-block__question--active' : ''}`}
    >
      <div className="question-block__question-head">
        <span className="question-block__chip">{header}</span>
        <span className="question-block__meta">
          Frage {questionIndex + 1} von {questionCount}
          {question.multiSelect && ' · mehrere möglich'}
        </span>
        {showsKeys && (
          <span className="question-block__keys">Tasten 1–{question.options.length}</span>
        )}
      </div>
      <p className="question-block__question-text">{question.question}</p>
      <div
        className="question-block__choices"
        role={question.multiSelect ? 'group' : 'radiogroup'}
        aria-label={header}
      >
        {question.options.map(renderOption)}
      </div>
    </section>
  );
}
