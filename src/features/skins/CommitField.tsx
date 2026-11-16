import { useId, useState } from 'react';
import type { KeyboardEvent, ReactElement, ReactNode } from 'react';
import { ToolName } from '@/features/skins/ToolName';
import type { SkinToolAction } from '@/features/skins/toolNames';
import './CommitField.css';

interface CommitFieldProps {
  label: ReactNode;
  value: string;
  multiline?: boolean;
  placeholder?: string;
  /** Der Fehlersatz, wenn `raw` nicht gespeichert werden darf; `null` = in Ordnung. */
  validate: (raw: string) => string | null;
  /** Speichert; liefert den Fehlersatz des Kerns oder `null`. */
  onCommit: (raw: string) => Promise<string | null>;
  /** Bei jedem Tastendruck, z. B. für eine Vorschau der Treffer. */
  onDraft?: (raw: string) => void;
  toolAction?: SkinToolAction;
}

/**
 * Ein Textfeld, das beim Verlassen speichert (Enter im einseitigen Feld auch). Zu lange oder leere
 * Eingaben werden in der Oberfläche abgewiesen, der Satz des Kerns erscheint unter dem Feld; der
 * eingetippte Text bleibt in beiden Fällen stehen.
 */
export function CommitField({
  label,
  value,
  multiline = false,
  placeholder,
  validate,
  onCommit,
  onDraft,
  toolAction,
}: CommitFieldProps): ReactElement {
  const inputId: string = useId();
  const errorId: string = useId();
  const [draft, setDraft] = useState<string>(value);
  const [seenValue, setSeenValue] = useState<string>(value);
  const [error, setError] = useState<string | null>(null);

  // Ein neuer Wert von außen (Agent, Speichern) ersetzt den Entwurf.
  if (seenValue !== value) {
    setSeenValue(value);
    setDraft(value);
  }

  function change(raw: string): void {
    setDraft(raw);
    onDraft?.(raw);
  }

  function commit(): void {
    if (draft === value) {
      setError(null);
      return;
    }
    const problem: string | null = validate(draft);
    if (problem !== null) {
      setError(problem);
      return;
    }
    onCommit(draft)
      .then(setError)
      .catch(() => undefined);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter') {
      event.currentTarget.blur();
    }
  }

  const describedBy: string | undefined = error === null ? undefined : errorId;
  return (
    <div className="commit-field">
      <label className="commit-field__label" htmlFor={inputId}>
        {label}
        {toolAction !== undefined && <ToolName action={toolAction} />}
      </label>
      {multiline ? (
        <textarea
          id={inputId}
          className="commit-field__input commit-field__input--multiline"
          value={draft}
          placeholder={placeholder}
          aria-invalid={error !== null}
          aria-describedby={describedBy}
          onChange={(event) => {
            change(event.target.value);
          }}
          onBlur={commit}
        />
      ) : (
        <input
          id={inputId}
          type="text"
          className="commit-field__input"
          value={draft}
          placeholder={placeholder}
          aria-invalid={error !== null}
          aria-describedby={describedBy}
          onChange={(event) => {
            change(event.target.value);
          }}
          onBlur={commit}
          onKeyDown={handleKeyDown}
        />
      )}
      {error !== null && (
        <p id={errorId} className="commit-field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
