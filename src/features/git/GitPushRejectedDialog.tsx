import type { ReactElement } from 'react';
import { Dialog } from '@/components/Dialog';
import { PUSH_REJECTED_PULL_LOCKED, pushRejectedText } from '@/features/git/gitTexts';
import type { GitEntryStatus } from '@/lib/bindings/GitEntryStatus';
import './GitDialog.css';

const TITLE_ID = 'git-push-rejected-title';

interface GitPushRejectedDialogProps {
  entry: GitEntryStatus;
  /** Eine Session des Vorhabens arbeitet: der Core lehnt den Pull ab. */
  isBusy: boolean;
  onCancel: () => void;
  onPullThenPush: () => void;
}

/** Ein Push, der abgelehnt würde, weil der Remote Commits hat, die hier fehlen. */
export function GitPushRejectedDialog({
  entry,
  isBusy,
  onCancel,
  onPullThenPush,
}: GitPushRejectedDialogProps): ReactElement {
  return (
    <Dialog labelledBy={TITLE_ID} className="git-dialog" onClose={onCancel}>
      <h3 id={TITLE_ID} className="git-dialog__title">
        Push abgelehnt
      </h3>
      <p className="git-dialog__text">{pushRejectedText(entry)}</p>
      <div className="git-dialog__actions">
        <button type="button" className="git-dialog__button" onClick={onCancel}>
          Abbrechen
        </button>
        <button
          type="button"
          className="git-dialog__button git-dialog__button--primary"
          disabled={isBusy}
          title={isBusy ? PUSH_REJECTED_PULL_LOCKED : undefined}
          onClick={onPullThenPush}
        >
          Pull, dann Push
        </button>
      </div>
    </Dialog>
  );
}
