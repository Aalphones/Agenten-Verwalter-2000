import type { ReactElement } from 'react';
import { Dialog } from '@/components/Dialog';
import { notMergedQuestion } from '@/features/git/gitTexts';
import './GitDialog.css';

const TITLE_ID = 'git-delete-branch-title';

interface GitDeleteBranchDialogProps {
  branch: string;
  onCancel: () => void;
  onForceDelete: () => void;
}

/** Ein Branch, den Git nicht als gemergt kennt: Löschen verwirft seine Commits, die sonst nirgends stehen. */
export function GitDeleteBranchDialog({
  branch,
  onCancel,
  onForceDelete,
}: GitDeleteBranchDialogProps): ReactElement {
  return (
    <Dialog labelledBy={TITLE_ID} className="git-dialog" onClose={onCancel}>
      <h3 id={TITLE_ID} className="git-dialog__title">
        Branch nicht gemergt
      </h3>
      <p className="git-dialog__text">{notMergedQuestion(branch)}</p>
      <div className="git-dialog__actions">
        <button type="button" className="git-dialog__button" onClick={onCancel}>
          Abbrechen
        </button>
        <button
          type="button"
          className="git-dialog__button git-dialog__button--primary"
          onClick={onForceDelete}
        >
          Trotzdem löschen
        </button>
      </div>
    </Dialog>
  );
}
