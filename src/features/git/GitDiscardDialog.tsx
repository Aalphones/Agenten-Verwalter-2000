import type { ReactElement } from 'react';
import { Dialog } from '@/components/Dialog';
import { discardQuestion } from '@/features/git/gitTexts';
import './GitDialog.css';

const TITLE_ID = 'git-discard-title';

interface GitDiscardDialogProps {
  path: string;
  onCancel: () => void;
  onDiscard: () => void;
}

export function GitDiscardDialog({
  path,
  onCancel,
  onDiscard,
}: GitDiscardDialogProps): ReactElement {
  return (
    <Dialog labelledBy={TITLE_ID} className="git-dialog" onClose={onCancel}>
      <h3 id={TITLE_ID} className="git-dialog__title">
        Änderung verwerfen?
      </h3>
      <p className="git-dialog__text">{discardQuestion(path)}</p>
      <div className="git-dialog__actions">
        <button type="button" className="git-dialog__button" onClick={onCancel}>
          Abbrechen
        </button>
        <button
          type="button"
          className="git-dialog__button git-dialog__button--primary"
          onClick={onDiscard}
        >
          Verwerfen
        </button>
      </div>
    </Dialog>
  );
}
