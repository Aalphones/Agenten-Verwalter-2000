import { useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent, ReactElement } from 'react';
import {
  COMMIT_MESSAGE_MISSING,
  commitButtonLabel,
  commitPlaceholder,
  FAILURE,
  SUGGEST_NOTHING_CHECKED_TITLE,
  SUGGEST_TITLE,
} from '@/features/git/gitTexts';
import { GitCommitMenu } from '@/features/git/GitCommitMenu';
import { CaretIcon, CheckIcon, SparkIcon } from '@/features/git/GitIcons';
import { GitMenuHost } from '@/features/git/GitMenuHost';
import { useGitActions } from '@/features/git/useGitActions';
import { useGitPush } from '@/features/git/useGitPush';
import { useMenuAnchor, type MenuAnchor } from '@/features/git/useMenuAnchor';
import type { GitEntryStatus } from '@/lib/bindings/GitEntryStatus';
import { commandErrorText } from '@/lib/errors';
import { gitCommit, suggestGitMessage } from '@/lib/git';
import { useSessionErrorsStore } from '@/stores/sessionErrors';
import { checkedPaths, isPathChecked, useGitStore, type GitSessionUi } from '@/stores/git';
import './GitCommitBox.css';

interface GitCommitBoxProps {
  sessionId: string;
  entry: GitEntryStatus;
  /** Eigene uncommittete Dateien (standardmäßig angehakt). */
  ownPaths: readonly string[];
  /** Fremde uncommittete Dateien (standardmäßig nicht angehakt). */
  foreignPaths: readonly string[];
  isBusy: boolean;
  onChanged: () => void;
}

/** Nachrichtenfeld und Commit-Knopf eines Eintrags. Committet genau die angehakten Dateien. */
export function GitCommitBox({
  sessionId,
  entry,
  ownPaths,
  foreignPaths,
  isBusy,
  onChanged,
}: GitCommitBoxProps): ReactElement {
  const { key } = entry;
  const [isSuggesting, setIsSuggesting] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menu: MenuAnchor = useMenuAnchor();
  const ui: GitSessionUi | undefined = useGitStore((state) => state.sessions[sessionId]);
  const setMessage = useGitStore((state) => state.setMessage);
  const clearEntry = useGitStore((state) => state.clearEntry);
  const reportError = useSessionErrorsStore((state) => state.report);
  const clearError = useSessionErrorsStore((state) => state.clear);
  const { run, isRunning } = useGitActions(sessionId, onChanged);
  const push = useGitPush(sessionId, entry, isBusy, onChanged);

  const message: string = ui?.messages[key] ?? '';
  const checkedCount: number =
    ownPaths.filter((path: string) => isPathChecked(ui, key, path, true)).length +
    foreignPaths.filter((path: string) => isPathChecked(ui, key, path, false)).length;
  const hasChecked: boolean = checkedCount > 0;
  const isWorking: boolean = isRunning || push.isRunning;

  async function commit(shouldPush: boolean, isAmend: boolean): Promise<void> {
    const paths: string[] = checkedPaths(sessionId, key, ownPaths, foreignPaths);
    if (!isAmend && paths.length === 0) {
      return;
    }
    if (!isAmend && message.trim() === '') {
      reportError(sessionId, COMMIT_MESSAGE_MISSING);
      textareaRef.current?.focus();
      return;
    }
    // Hat der Remote Commits, die hier fehlen, würde der Push abgelehnt: erst committen, dann fragt der Dialog.
    const pushWithCommit: boolean = shouldPush && entry.behind === 0;
    const succeeded: boolean = await run(
      () => gitCommit(sessionId, key, paths, message, pushWithCommit, isAmend),
      FAILURE.commit,
    );
    if (!succeeded) {
      return;
    }
    clearEntry(sessionId, key);
    if (shouldPush && !pushWithCommit) {
      push.requestPush();
    }
  }

  async function suggest(): Promise<void> {
    const paths: string[] = checkedPaths(sessionId, key, ownPaths, foreignPaths);
    if (paths.length === 0) {
      return;
    }
    setIsSuggesting(true);
    try {
      setMessage(sessionId, key, await suggestGitMessage(sessionId, key, paths));
      clearError(sessionId);
    } catch (reason: unknown) {
      console.error('Nachrichtenvorschlag fehlgeschlagen', reason);
      reportError(sessionId, `${FAILURE.suggest}: ${commandErrorText(reason)}`);
    } finally {
      setIsSuggesting(false);
    }
  }

  function suggestTitle(): string {
    return hasChecked ? SUGGEST_TITLE : SUGGEST_NOTHING_CHECKED_TITLE;
  }

  function startCommit(shouldPush: boolean, isAmend: boolean): void {
    commit(shouldPush, isAmend).catch(() => undefined);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key !== 'Enter' || !event.ctrlKey) {
      return;
    }
    event.preventDefault();
    startCommit(event.shiftKey, false);
  }

  return (
    <div className="git-commit-box">
      <div className="git-commit-box__field">
        <textarea
          ref={textareaRef}
          className="git-commit-box__message"
          aria-label="Commit-Nachricht"
          placeholder={commitPlaceholder(entry.branch)}
          value={message}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>): void => {
            setMessage(sessionId, key, event.target.value);
          }}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          className={`git-commit-box__suggest${isSuggesting ? ' git-commit-box__suggest--running' : ''}`}
          aria-label="Nachricht vorschlagen"
          title={suggestTitle()}
          disabled={!hasChecked || isSuggesting || isWorking}
          onClick={(): void => {
            suggest().catch(() => undefined);
          }}
        >
          <SparkIcon />
        </button>
      </div>
      <div className="git-commit-box__split">
        <button
          type="button"
          className="git-commit-box__commit"
          disabled={!hasChecked || isWorking}
          onClick={(): void => {
            startCommit(false, false);
          }}
        >
          <CheckIcon />
          {commitButtonLabel(checkedCount)}
        </button>
        <button
          type="button"
          className="git-commit-box__drop"
          aria-label="Weitere Commit-Arten"
          aria-expanded={menu.anchor !== null}
          disabled={isWorking}
          {...menu.trigger}
        >
          <CaretIcon />
        </button>
      </div>
      {menu.anchor !== null && (
        <GitMenuHost anchor={menu.anchor}>
          <GitCommitMenu
            hasChecked={hasChecked}
            isHeadPushed={entry.headPushed}
            onClose={menu.close}
            onCommit={(): void => {
              startCommit(false, false);
            }}
            onCommitAndPush={(): void => {
              startCommit(true, false);
            }}
            onAmend={(): void => {
              startCommit(false, true);
            }}
          />
        </GitMenuHost>
      )}
      {push.dialog}
    </div>
  );
}
