import type { ReactElement } from 'react';
import './CollectedNote.css';

interface CollectedNoteProps {
  text: string;
  onEdit: () => void;
  onRemove: () => void;
}

export function CollectedNote({ text, onEdit, onRemove }: CollectedNoteProps): ReactElement {
  return (
    <div className="collected-note">
      <div className="collected-note__content">
        <span className="collected-note__label">
          Gesammelt · geht mit deiner nächsten Nachricht im Chat raus
        </span>
        <span className="collected-note__text">{text}</span>
      </div>
      <button type="button" className="collected-note__edit" onClick={onEdit}>
        Bearbeiten
      </button>
      <button
        type="button"
        className="collected-note__remove"
        aria-label="Kommentar entfernen"
        title="Kommentar entfernen"
        onClick={onRemove}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M3 3l6 6" />
          <path d="M9 3l-6 6" />
        </svg>
      </button>
    </div>
  );
}
