import { useState } from 'react';
import type { ReactElement } from 'react';
import {
  branchLabel,
  FAILURE,
  LOCKED_TITLE,
  PUBLISH_TITLE,
  pullTitle,
  pushTitle,
} from '@/features/git/gitTexts';
import { GitBranchMenu } from '@/features/git/GitBranchMenu';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  BranchIcon,
  CaretIcon,
  MoreIcon,
} from '@/features/git/GitIcons';
import { GitMenuHost } from '@/features/git/GitMenuHost';
import { GitMoreMenu } from '@/features/git/GitMoreMenu';
import { GitSwitchDialog } from '@/features/git/GitSwitchDialog';
import { useGitActions } from '@/features/git/useGitActions';
import { useGitPush } from '@/features/git/useGitPush';
import { useMenuAnchor, type MenuAnchor } from '@/features/git/useMenuAnchor';
import type { GitEntryStatus } from '@/lib/bindings/GitEntryStatus';
import type { GitSwitchMode } from '@/lib/bindings/GitSwitchMode';
import { gitPull, gitSwitch } from '@/lib/git';
import './GitEntryBar.css';

interface GitEntryBarProps {
  sessionId: string;
  entry: GitEntryStatus;
  entryName: string;
  /** Alle ungecommitteten Pfade des Eintrags, eigene und fremde. */
  dirtyPaths: readonly string[];
  /** Eine Session des Vorhabens arbeitet: Wechsel und Pull sind gesperrt. */
  isBusy: boolean;
  onChanged: () => void;
}

/** Rechte Seite der Repository-Zeile: Branch-Knopf, Pull, Push und das ⋯-Menü. */
export function GitEntryBar({
  sessionId,
  entry,
  entryName,
  dirtyPaths,
  isBusy,
  onChanged,
}: GitEntryBarProps): ReactElement {
  const [pendingSwitch, setPendingSwitch] = useState<string | null>(null);
  const branchMenu: MenuAnchor = useMenuAnchor();
  const moreMenu: MenuAnchor = useMenuAnchor();
  const { run, isRunning } = useGitActions(sessionId, onChanged);
  const push = useGitPush(sessionId, entry, isBusy, onChanged);
  const { key } = entry;
  const isPublish: boolean = entry.upstream === null && entry.branch !== null;

  function switchTo(branch: string, mode: GitSwitchMode): void {
    setPendingSwitch(null);
    run(() => gitSwitch(sessionId, key, branch, mode), FAILURE.switchBranch).catch(() => undefined);
  }

  function requestSwitch(branch: string): void {
    if (dirtyPaths.length === 0) {
      switchTo(branch, 'plain');
      return;
    }
    setPendingSwitch(branch);
  }

  function pull(): void {
    run(() => gitPull(sessionId, key), FAILURE.pull).catch(() => undefined);
  }

  return (
    <div className="git-entry-bar">
      <button
        type="button"
        className="git-entry-bar__branch"
        title="Branch wechseln oder anlegen"
        aria-expanded={branchMenu.anchor !== null}
        {...branchMenu.trigger}
      >
        <BranchIcon />
        <span className="git-entry-bar__branch-name">{branchLabel(entry.branch)}</span>
        <CaretIcon />
      </button>
      {branchMenu.anchor !== null && (
        <GitMenuHost anchor={branchMenu.anchor}>
          <GitBranchMenu
            sessionId={sessionId}
            entry={entry}
            isBusy={isBusy}
            onClose={branchMenu.close}
            onSwitch={requestSwitch}
            onChanged={onChanged}
          />
        </GitMenuHost>
      )}
      <button
        type="button"
        className={`git-entry-bar__sync${entry.behind > 0 ? ' git-entry-bar__sync--hot' : ''}`}
        disabled={isBusy || isRunning}
        title={isBusy ? `${pullTitle(entry)}\n${LOCKED_TITLE}` : pullTitle(entry)}
        onClick={pull}
      >
        <ArrowDownIcon />
        {String(entry.behind)}
      </button>
      <button
        type="button"
        className={`git-entry-bar__sync${entry.ahead > 0 || isPublish ? ' git-entry-bar__sync--hot' : ''}`}
        disabled={isRunning || push.isRunning}
        title={isPublish ? PUBLISH_TITLE : pushTitle(entry)}
        onClick={push.requestPush}
      >
        <ArrowUpIcon />
        {isPublish ? 'Veröffentlichen' : String(entry.ahead)}
      </button>
      <button
        type="button"
        className="git-entry-bar__more"
        title="Weitere Befehle"
        aria-label="Weitere Befehle"
        aria-expanded={moreMenu.anchor !== null}
        {...moreMenu.trigger}
      >
        <MoreIcon />
      </button>
      {moreMenu.anchor !== null && (
        <GitMenuHost anchor={moreMenu.anchor}>
          <GitMoreMenu
            sessionId={sessionId}
            entry={entry}
            isBusy={isBusy}
            onClose={moreMenu.close}
            onChanged={onChanged}
          />
        </GitMenuHost>
      )}
      {push.dialog}
      {pendingSwitch !== null && (
        <GitSwitchDialog
          branch={pendingSwitch}
          entryName={entryName}
          paths={dirtyPaths}
          onCancel={(): void => {
            setPendingSwitch(null);
          }}
          onTake={(): void => {
            switchTo(pendingSwitch, 'plain');
          }}
          onStash={(): void => {
            switchTo(pendingSwitch, 'stash');
          }}
        />
      )}
    </div>
  );
}
