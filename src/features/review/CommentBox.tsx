import { useEffect, useRef } from 'react';
import type { ChangeEvent, KeyboardEvent, ReactElement } from 'react';
import './CommentBox.css';

const PLACEHOLDER = 'Was soll der Agent hier ändern oder erklären?';
const HINT =
  'Wird im Chat gesammelt und mit deiner nächsten Nachricht gesendet · Strg+Enter hinzufügen · Esc abbrechen';

interface CommentBoxProps {
  fileLabel: string;
  /** Leer: die Kopfzeile nennt nur `fileLabel`. */
  lineLabel: string;
  /** Ersetzt den Hinweis unter dem Feld. */
  hint?: string;
  /** Beschriftung des Knopfs beim Anlegen; beim Bearbeiten steht „Speichern“. */
  submitLabel?: string;
  text: string;
  isEditing: boolean;
  /**
   * Gerade per Klick geöffnet: beim Einhängen ins Bild scrollen. Sonst nur fokussieren — die virtualisierte
   * Liste hängt die Zeile beim Zurückscrollen neu ein, ein Scrollen dabei ließe den Diff springen.
   */
  shouldReveal: boolean;
  onRevealed: () => void;
  onChange: (text: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function CommentBox({
  fileLabel,
  lineLabel,
  hint = HINT,
  submitLabel = 'Zum Chat hinzufügen',
  text,
  isEditing,
  shouldReveal,
  onRevealed,
  onChange,
  onSubmit,
  onCancel,
}: CommentBoxProps): ReactElement {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isEmpty: boolean = text.trim() === '';

  // Nur beim Einhängen; spätere Wechsel von `shouldReveal` betreffen ein schon fokussiertes Feld.
  useEffect(() => {
    textareaRef.current?.focus({ preventScroll: !shouldReveal });
    if (shouldReveal) {
      onRevealed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onCancel();
      return;
    }
    if (event.key === 'Enter' && event.ctrlKey) {
      event.preventDefault();
      event.stopPropagation();
      if (!isEmpty) {
        onSubmit();
      }
    }
  }

  return (
    <div className="comment-box">
      <span className="comment-box__head">
        Kommentar zu{' '}
        <span className="comment-box__where">
          {lineLabel === '' ? fileLabel : `${fileLabel} · ${lineLabel}`}
        </span>
      </span>
      <textarea
        ref={textareaRef}
        className="comment-box__input"
        aria-label="Kommentar"
        placeholder={PLACEHOLDER}
        value={text}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>): void => {
          onChange(event.target.value);
        }}
        onKeyDown={handleKeyDown}
      />
      <div className="comment-box__footer">
        <span className="comment-box__hint">{hint}</span>
        <button type="button" className="comment-box__cancel" onClick={onCancel}>
          Abbrechen
        </button>
        <button type="button" className="comment-box__submit" disabled={isEmpty} onClick={onSubmit}>
          {isEditing ? 'Speichern' : submitLabel}
        </button>
      </div>
    </div>
  );
}
