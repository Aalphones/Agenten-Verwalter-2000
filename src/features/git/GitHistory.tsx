import type { ReactElement } from 'react';
import { layoutGraph, type GraphRow } from '@/features/git/gitGraph';
import { refMarks, type RefMark } from '@/features/git/gitRefs';
import {
  fetchTitle,
  FAILURE,
  incomingText,
  LOCKED_TITLE,
  unpushedTitle,
} from '@/features/git/gitTexts';
import { BranchIcon, CloudIcon, FetchIcon } from '@/features/git/GitIcons';
import { GraphCell } from '@/features/git/GraphCell';
import { useGitActions } from '@/features/git/useGitActions';
import { useGitLog } from '@/features/git/useGitLog';
import type { GitEntryStatus } from '@/lib/bindings/GitEntryStatus';
import type { GitLogCommit } from '@/lib/bindings/GitLogCommit';
import type { GitOwnCommit } from '@/lib/bindings/GitOwnCommit';
import { gitFetch, gitPull } from '@/lib/git';
import './GitHistory.css';

interface GitHistoryProps {
  sessionId: string;
  entry: GitEntryStatus;
  entryName: string;
  /** Eine Session des Vorhabens arbeitet: Pull ist gesperrt. */
  isBusy: boolean;
  onChanged: () => void;
}

/** Alles, was den Verlauf ändern kann und der Git-Zustand schon kennt. */
function refreshSignal(entry: GitEntryStatus): string {
  return [
    entry.branch ?? '',
    entry.upstream ?? '',
    String(entry.ahead),
    String(entry.behind),
    String(entry.lastFetchMs ?? ''),
    entry.operation,
    entry.commits.map((commit: GitOwnCommit) => commit.id).join(','),
  ].join('|');
}

/** Der Verlauf des ausgecheckten Branches als Graph, darüber die Commits, die der Upstream noch hat. */
export function GitHistory({
  sessionId,
  entry,
  entryName,
  isBusy,
  onChanged,
}: GitHistoryProps): ReactElement {
  const { key } = entry;
  const { log, error } = useGitLog(sessionId, key, refreshSignal(entry));
  const { run, isRunning } = useGitActions(sessionId, onChanged);

  function fetch(): void {
    run(() => gitFetch(sessionId, key), FAILURE.fetch).catch(() => undefined);
  }

  function pull(): void {
    run(() => gitPull(sessionId, key), FAILURE.pull).catch(() => undefined);
  }

  function renderIncoming(commits: readonly GitLogCommit[]): ReactElement | null {
    const newest: GitLogCommit | undefined = commits[0];
    if (newest === undefined || entry.upstream === null) {
      return null;
    }
    return (
      <div className="git-history__incoming">
        <span>{incomingText(commits.length, entry.upstream)}</span>
        <span className="git-history__sha">{newest.shortId}</span>
        <button
          type="button"
          className="git-history__pull"
          disabled={isBusy || isRunning}
          title={isBusy ? LOCKED_TITLE : undefined}
          onClick={pull}
        >
          Pull
        </button>
      </div>
    );
  }

  function renderMark(mark: RefMark): ReactElement {
    return (
      <span
        key={`${mark.kind}:${mark.label}`}
        className={`git-history__ref git-history__ref--${mark.kind}`}
      >
        {mark.kind === 'local' && <BranchIcon size={11} />}
        {mark.kind === 'remote' && <CloudIcon size={11} />}
        {mark.label}
      </span>
    );
  }

  function renderRow(commit: GitLogCommit, row: GraphRow, index: number): ReactElement {
    return (
      <div
        key={commit.id}
        className={`git-history__row${index === 0 ? ' git-history__row--head' : ''}`}
        title={unpushedTitle(commit.subject, commit.pushed)}
      >
        <GraphCell row={row} commitId={commit.id} isUnpushed={!commit.pushed} />
        <span className="git-history__subject">{commit.subject}</span>
        {commit.own && <span className="git-history__own">diese Session</span>}
        {refMarks(commit.refs).map(renderMark)}
        <span className="git-history__author">{commit.author}</span>
      </div>
    );
  }

  function renderBody(): ReactElement | null {
    if (log === null) {
      if (error === null) {
        return null;
      }
      return (
        <p className="git-history__error" role="alert">
          {error}
        </p>
      );
    }
    const rows: GraphRow[] = layoutGraph(log.commits);
    return (
      <>
        {renderIncoming(log.incoming)}
        {log.commits.map((commit: GitLogCommit, index: number): ReactElement | null => {
          const row: GraphRow | undefined = rows[index];
          return row === undefined ? null : renderRow(commit, row, index);
        })}
      </>
    );
  }

  return (
    <section className="git-history" aria-label={`Verlauf ${entryName}`}>
      <div className="git-history__head">
        <h3 className="git-history__title">Verlauf · {entryName}</h3>
        <button
          type="button"
          className="git-history__fetch"
          aria-label="Fetch"
          disabled={isRunning}
          title={fetchTitle(entry.lastFetchMs)}
          onClick={fetch}
        >
          <FetchIcon />
        </button>
      </div>
      {renderBody()}
    </section>
  );
}
