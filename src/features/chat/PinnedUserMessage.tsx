import type { ReactElement } from 'react';
import './PinnedUserMessage.css';

const ATTACHMENTS_ONLY_TEXT = 'Nachricht nur mit Anhängen';

interface PinnedUserMessageProps {
  text: string;
  /** Abstand von oben: die Höhe der TL;DR-Überlagerung, unter der die Nachricht hängt. */
  top: number;
  onJump: () => void;
}

/** Die letzte Nachricht des Benutzers, sobald sie oben aus dem Verlauf gescrollt ist; ein Klick springt zu ihr. */
export function PinnedUserMessage({ text, top, onJump }: PinnedUserMessageProps): ReactElement {
  const body: string = text.trim();
  return (
    <div className="pinned-user-message" style={{ top: `${String(top)}px` }}>
      <button
        type="button"
        className="pinned-user-message__box"
        title="Zur Nachricht springen"
        onClick={onJump}
      >
        <span className="pinned-user-message__text">
          {body === '' ? ATTACHMENTS_ONLY_TEXT : body}
        </span>
      </button>
    </div>
  );
}
