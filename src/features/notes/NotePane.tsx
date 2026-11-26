import { useEffect } from 'react';
import type { ReactElement } from 'react';
import { useProjectNote } from '@/features/notes/useProjectNote';
import type { NoteState } from '@/features/notes/useProjectNote';
import './NotePane.css';

const PLACEHOLDER =
  'Befehle zusammenbauen, Token ergänzen … — wird automatisch gespeichert, Agenten sehen diese Notiz nicht.';

interface NotePaneProps {
  projectId: string;
  /** Meldet den Fehlersatz der Notiz an die Fehlerzeile des Anzeigeorts. */
  onError?: (message: string | null) => void;
}

function statusText(state: NoteState): string {
  if (state === 'saving') {
    return 'Speichert …';
  }
  if (state === 'saved') {
    return 'Gespeichert';
  }
  return '';
}

export function NotePane({ projectId, onError }: NotePaneProps): ReactElement {
  const { text, state, error, setText, flush } = useProjectNote(projectId);

  useEffect(() => {
    onError?.(error);
    return (): void => {
      onError?.(null);
    };
  }, [error, onError]);

  return (
    <div className="note-pane">
      <div className="note-pane__bar">
        <div className="note-pane__tools" />
        <span className="note-pane__status" role="status">
          {statusText(state)}
        </span>
      </div>
      <textarea
        className="note-pane__text"
        value={text}
        placeholder={PLACEHOLDER}
        wrap="off"
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        disabled={state === 'loading'}
        aria-label="Notiz"
        onChange={(event): void => {
          setText(event.target.value);
        }}
        onBlur={flush}
      />
    </div>
  );
}
