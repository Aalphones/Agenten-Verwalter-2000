import { useEffect, useId, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import './ColorField.css';

/** Wie lange nach der letzten Bewegung im Farbwähler gespeichert wird. */
const COMMIT_DELAY_MS = 300;

interface ColorFieldProps {
  label: string;
  /** `#rrggbb`. */
  value: string;
  /** Warnsatz zum Kontrast; `null` = in Ordnung. */
  warning: string | null;
  onCommit: (value: string) => void;
}

/** Ein Farbfeld; Ziehen im Farbwähler speichert entprellt, Loslassen und Verlassen sofort. */
export function ColorField({ label, value, warning, onCommit }: ColorFieldProps): ReactElement {
  const inputId: string = useId();
  const [draft, setDraft] = useState<string>(value);
  const [seenValue, setSeenValue] = useState<string>(value);
  const timerRef = useRef<number | undefined>(undefined);

  // Ein neuer Wert von außen ersetzt den Entwurf.
  if (seenValue !== value) {
    setSeenValue(value);
    setDraft(value);
  }

  useEffect(
    () => (): void => {
      window.clearTimeout(timerRef.current);
    },
    [],
  );

  function flush(next: string): void {
    window.clearTimeout(timerRef.current);
    timerRef.current = undefined;
    if (next !== value) {
      onCommit(next);
    }
  }

  function change(next: string): void {
    setDraft(next);
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      flush(next);
    }, COMMIT_DELAY_MS);
  }

  return (
    <div className="color-field">
      <input
        id={inputId}
        type="color"
        className="color-field__input"
        value={draft}
        onChange={(event) => {
          change(event.target.value);
        }}
        onBlur={(): void => {
          flush(draft);
        }}
      />
      <label className="color-field__label" htmlFor={inputId}>
        {label}
      </label>
      {warning !== null && <span className="color-field__warning">{warning}</span>}
    </div>
  );
}
