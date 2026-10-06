import type { ReactElement } from 'react';
import { Popover } from '@/components/Popover';
import { abortLabel, FAILURE, LOCKED_TITLE } from '@/features/git/gitTexts';
import { FetchIcon } from '@/features/git/GitIcons';
import { useGitActions } from '@/features/git/useGitActions';
import type { GitEntryStatus } from '@/lib/bindings/GitEntryStatus';
import { gitAbortOperation, gitFetch } from '@/lib/git';
import './GitMenu.css';

const MORE_MENU_WIDTH = 280;

interface GitMoreMenuProps {
  sessionId: string;
  entry: GitEntryStatus;
  isBusy: boolean;
  onClose: () => void;
  onChanged: () => void;
}

/** Das ⋯-Menü eines Eintrags: Fetch und, bei einem angehaltenen Merge oder Rebase, dessen Abbruch. */
export function GitMoreMenu({
  sessionId,
  entry,
  isBusy,
  onClose,
  onChanged,
}: GitMoreMenuProps): ReactElement {
  const { run } = useGitActions(sessionId, onChanged);
  const { key } = entry;

  function fetch(): void {
    onClose();
    run(() => gitFetch(sessionId, key), FAILURE.fetch).catch(() => undefined);
  }

  function abort(): void {
    onClose();
    run(() => gitAbortOperation(sessionId, key), FAILURE.abort).catch(() => undefined);
  }

  return (
    <Popover
      label="Weitere Befehle"
      placement="below"
      align="end"
      width={MORE_MENU_WIDTH}
      onClose={onClose}
    >
      <button type="button" className="git-menu__item" onClick={fetch}>
        <span className="git-menu__check">
          <FetchIcon />
        </span>
        <span className="git-menu__label">Fetch</span>
      </button>
      {entry.operation !== 'none' && (
        <button
          type="button"
          className="git-menu__item"
          disabled={isBusy}
          title={isBusy ? LOCKED_TITLE : undefined}
          onClick={abort}
        >
          <span className="git-menu__check" />
          <span className="git-menu__label">{abortLabel(entry.operation)}</span>
        </button>
      )}
    </Popover>
  );
}
