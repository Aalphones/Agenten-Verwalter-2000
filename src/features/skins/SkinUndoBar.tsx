import { useEffect, useEffectEvent } from 'react';
import type { ReactElement } from 'react';
import './SkinUndoBar.css';

/** So lange steht „Rückgängig“ zur Verfügung. */
export const UNDO_VISIBLE_MS = 8000;

interface SkinUndoBarProps {
  message: string;
  /** Fehlt er, zeigt die Leiste nur den Satz (Meldung ohne Knopf). */
  onUndo?: () => void;
  /** Nach `UNDO_VISIBLE_MS`; der Aufrufer räumt die Leiste dann ab. */
  onExpire: () => void;
}

/** Die Leiste „… gelöscht. Rückgängig“ (oder ein Satz ohne Knopf); ein neuer `message`-Text startet die 8 Sekunden neu. */
export function SkinUndoBar({ message, onUndo, onExpire }: SkinUndoBarProps): ReactElement {
  const expire = useEffectEvent((): void => {
    onExpire();
  });

  useEffect(() => {
    const timer: number = window.setTimeout(() => {
      expire();
    }, UNDO_VISIBLE_MS);
    return (): void => {
      window.clearTimeout(timer);
    };
  }, [message]);

  return (
    <div className="skin-undo" role="status">
      <span className="skin-undo__text">{message}</span>
      {onUndo !== undefined && (
        <button type="button" className="settings-view__button" onClick={onUndo}>
          Rückgängig
        </button>
      )}
    </div>
  );
}
