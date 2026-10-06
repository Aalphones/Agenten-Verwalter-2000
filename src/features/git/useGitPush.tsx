import { useState } from 'react';
import type { ReactElement } from 'react';
import { FAILURE } from '@/features/git/gitTexts';
import { GitPushRejectedDialog } from '@/features/git/GitPushRejectedDialog';
import { useGitActions } from '@/features/git/useGitActions';
import type { GitEntryStatus } from '@/lib/bindings/GitEntryStatus';
import { gitPull, gitPush } from '@/lib/git';

export interface GitPush {
  /** Pusht, oder fragt zuerst, wenn der Remote Commits hat, die hier fehlen. */
  requestPush: () => void;
  isRunning: boolean;
  /** Der Dialog „Push abgelehnt“, solange er offen ist. */
  dialog: ReactElement | null;
}

/** Der Push-Ablauf, den der Push-Knopf und „Commit & Push“ teilen. */
export function useGitPush(
  sessionId: string,
  entry: GitEntryStatus,
  isBusy: boolean,
  onChanged: () => void,
): GitPush {
  const [isAsking, setIsAsking] = useState<boolean>(false);
  const { run, isRunning } = useGitActions(sessionId, onChanged);
  const { key } = entry;

  function requestPush(): void {
    if (entry.behind > 0) {
      setIsAsking(true);
      return;
    }
    run(() => gitPush(sessionId, key), FAILURE.push).catch(() => undefined);
  }

  function pullThenPush(): void {
    setIsAsking(false);
    run(async (): Promise<void> => {
      await gitPull(sessionId, key);
      await gitPush(sessionId, key);
    }, FAILURE.pullThenPush).catch(() => undefined);
  }

  const dialog: ReactElement | null = isAsking ? (
    <GitPushRejectedDialog
      entry={entry}
      isBusy={isBusy}
      onCancel={(): void => {
        setIsAsking(false);
      }}
      onPullThenPush={pullThenPush}
    />
  ) : null;

  return { requestPush, isRunning, dialog };
}
