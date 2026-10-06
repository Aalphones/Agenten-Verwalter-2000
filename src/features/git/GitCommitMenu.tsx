import type { ReactElement } from 'react';
import { Popover } from '@/components/Popover';
import { AMEND_ONLY_UNPUSHED } from '@/features/git/gitTexts';
import { ArrowUpIcon, CheckIcon, UndoIcon } from '@/features/git/GitIcons';
import './GitMenu.css';

const COMMIT_MENU_WIDTH = 300;

interface GitCommitMenuProps {
  /** Es ist mindestens eine Datei angehakt. */
  hasChecked: boolean;
  /** `HEAD` liegt schon im Upstream: Ergänzen ist gesperrt. */
  isHeadPushed: boolean;
  onClose: () => void;
  onCommit: () => void;
  onCommitAndPush: () => void;
  onAmend: () => void;
}

/** Das Menü am Pfeil des Commit-Knopfs. */
export function GitCommitMenu({
  hasChecked,
  isHeadPushed,
  onClose,
  onCommit,
  onCommitAndPush,
  onAmend,
}: GitCommitMenuProps): ReactElement {
  function choose(action: () => void): () => void {
    return (): void => {
      onClose();
      action();
    };
  }

  return (
    <Popover
      label="Commit"
      placement="below"
      align="end"
      width={COMMIT_MENU_WIDTH}
      onClose={onClose}
    >
      <button
        type="button"
        className="git-menu__item"
        disabled={!hasChecked}
        onClick={choose(onCommit)}
      >
        <span className="git-menu__check">
          <CheckIcon />
        </span>
        <span className="git-menu__label">Commit</span>
        <span className="git-menu__sub">Strg+Enter</span>
      </button>
      <button
        type="button"
        className="git-menu__item"
        disabled={!hasChecked}
        onClick={choose(onCommitAndPush)}
      >
        <span className="git-menu__check">
          <ArrowUpIcon />
        </span>
        <span className="git-menu__label">Commit &amp; Push</span>
        <span className="git-menu__sub">Strg+Umschalt+Enter</span>
      </button>
      <hr className="git-menu__divider" />
      <button
        type="button"
        className="git-menu__item"
        disabled={isHeadPushed}
        onClick={choose(onAmend)}
      >
        <span className="git-menu__check">
          <UndoIcon />
        </span>
        <span className="git-menu__label">Letzten Commit ergänzen</span>
      </button>
      <div className="git-menu__note">{AMEND_ONLY_UNPUSHED}</div>
    </Popover>
  );
}
