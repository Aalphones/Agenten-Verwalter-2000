import type { ReactElement } from 'react';
import { Dialog } from '@/components/Dialog';
import './SessionDeleteDialog.css';

const TITLE_ID = 'session-delete-title';

interface SessionDeleteDialogProps {
  name: string;
  /** Die Session ist die einzige im Vorhaben — das Vorhaben verschwindet mit. */
  isOnlySession: boolean;
  onCancel: () => void;
  onDelete: () => void;
}

/** Bestätigung vor dem endgültigen Löschen einer Session. */
export function SessionDeleteDialog({
  name,
  isOnlySession,
  onCancel,
  onDelete,
}: SessionDeleteDialogProps): ReactElement {
  return (
    <Dialog labelledBy={TITLE_ID} className="session-delete-dialog" onClose={onCancel}>
      <h3 id={TITLE_ID} className="session-delete-dialog__title">
        Session löschen?
      </h3>
      <p className="session-delete-dialog__text">
        „{name}“ wird beendet und samt Verlauf endgültig gelöscht.
        {isOnlySession &&
          ' Es ist die einzige Session des Vorhabens — das Vorhaben verschwindet mit.'}{' '}
        Das lässt sich nicht rückgängig machen.
      </p>
      <div className="session-delete-dialog__actions">
        <button type="button" className="session-delete-dialog__button" onClick={onCancel}>
          Abbrechen
        </button>
        <button
          type="button"
          className="session-delete-dialog__button session-delete-dialog__button--danger"
          onClick={onDelete}
        >
          Löschen
        </button>
      </div>
    </Dialog>
  );
}
