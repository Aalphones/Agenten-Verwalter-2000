import type { ReactElement } from 'react';
import { fileCountLabel, formatCount } from '@/features/changes/changesScope';
import { ChangeMarks } from '@/features/files/ChangeMarks';
import { FileTypeIcon } from '@/features/files/FileTypeIcon';
import type { ChangeScope } from '@/lib/bindings/ChangeScope';
import type { HistoryCommit } from '@/lib/bindings/HistoryCommit';
import type { HistoryFile } from '@/lib/bindings/HistoryFile';
import type { HistorySession } from '@/lib/bindings/HistorySession';
import type { ProjectHistory } from '@/lib/bindings/ProjectHistory';
import './HistoryList.css';

const TIME_FORMAT = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
const MILLISECONDS_PER_SECOND = 1000;

/** Schlüssel eines Commits in `openCommits`. */
export function commitKey(commit: HistoryCommit): string {
  return `${commit.key}|${commit.id}`;
}

interface HistoryListProps {
  history: ProjectHistory | null;
  error: string | null;
  sessionFilter: string | null;
  scope: ChangeScope;
  /** Mehrere Repositories: jede Commit-Zeile nennt ihres. */
  isMultiGroup: boolean;
  openCommits: readonly string[];
  onToggleCommit: (key: string) => void;
  onFilterSession: (sessionId: string) => void;
  onOpenFile: (commit: HistoryCommit, file: HistoryFile) => void;
}

/** „Verlauf · wer wann was geändert hat“: je Session ihre Commits, neueste zuerst. */
export function HistoryList({
  history,
  error,
  sessionFilter,
  scope,
  isMultiGroup,
  openCommits,
  onToggleCommit,
  onFilterSession,
  onOpenFile,
}: HistoryListProps): ReactElement {
  if (scope === 'uncommitted') {
    return renderEmpty('Nichts offen', 'Alles, was das Vorhaben geändert hat, ist committed.');
  }
  if (history === null) {
    return error === null ? (
      <p className="history-list__note">Verlauf wird gelesen …</p>
    ) : (
      <p className="history-list__error">Verlauf nicht lesbar: {error}</p>
    );
  }
  const sessions: HistorySession[] = history.sessions.filter(
    (session: HistorySession) =>
      session.commits.length > 0 && (sessionFilter === null || session.sessionId === sessionFilter),
  );

  function renderCommit(commit: HistoryCommit): ReactElement {
    const key: string = commitKey(commit);
    const isOpen: boolean = openCommits.includes(key);
    let added = 0;
    let deleted = 0;
    for (const file of commit.files) {
      added += file.added;
      deleted += file.deleted;
    }
    return (
      <li key={key}>
        <button
          type="button"
          className="history-list__commit"
          aria-expanded={isOpen}
          title={commit.subject}
          onClick={(): void => {
            onToggleCommit(key);
          }}
        >
          <svg
            className={`history-list__chevron${isOpen ? ' history-list__chevron--open' : ''}`}
            width="12"
            height="12"
            viewBox="0 0 12 12"
            aria-hidden="true"
          >
            <path d="M4.5 3l3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          <span className="history-list__pill">{commit.shortId}</span>
          <span className="history-list__subject">
            {commit.subject}
            {commit.loose && (
              <span className="history-list__loose"> · nicht auf einem ausgecheckten Branch</span>
            )}
          </span>
          {isMultiGroup && <span className="history-list__group">{commit.groupName}</span>}
          <span className="history-list__count">{fileCountLabel(commit.files.length)}</span>
          <ChangeMarks added={added} deleted={deleted} />
        </button>
        {isOpen && (
          <ul className="history-list__files">
            {commit.files.map((file: HistoryFile) => (
              <li key={file.path}>
                <button
                  type="button"
                  className="history-list__file"
                  title={file.path}
                  onClick={(): void => {
                    onOpenFile(commit, file);
                  }}
                >
                  <FileTypeIcon path={file.path} />
                  <span className="history-list__path">&lrm;{file.path}</span>
                  <ChangeMarks
                    added={file.added}
                    deleted={file.deleted}
                    kind={file.kind}
                    binary={file.binary}
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </li>
    );
  }

  function renderSession(session: HistorySession): ReactElement {
    const isFiltered: boolean = session.sessionId === sessionFilter;
    const newest: HistoryCommit | undefined = session.commits[0];
    return (
      <section
        key={session.sessionId}
        className={`history-list__session${isFiltered ? ' history-list__session--on' : ''}`}
        aria-label={`Session #${String(session.number)}`}
      >
        <div className="history-list__head">
          <span className="history-list__number">#{session.number}</span>
          <span className="history-list__name">{session.name}</span>
          {newest !== undefined && (
            <span className="history-list__time">
              {TIME_FORMAT.format(new Date(newest.time * MILLISECONDS_PER_SECOND))}
            </span>
          )}
          {!isFiltered && (
            <button
              type="button"
              className="files-button files-button--small files-button--quiet"
              onClick={(): void => {
                onFilterSession(session.sessionId);
              }}
            >
              Nur diese Session
            </button>
          )}
        </div>
        <ul className="history-list__commits">{session.commits.map(renderCommit)}</ul>
      </section>
    );
  }

  return (
    <div className="history-list">
      {sessions.length === 0
        ? renderEmpty('Keine Commits', 'In dieser Auswahl hat keine Session etwas committet.')
        : sessions.map(renderSession)}
      {history.missing > 0 && (
        <p className="history-list__note">
          {history.missing === 1
            ? '1 Commit gibt es im Repository nicht mehr.'
            : `${formatCount(history.missing)} Commits gibt es im Repository nicht mehr.`}
        </p>
      )}
      {error !== null && <p className="history-list__error">Verlauf nicht aktuell: {error}</p>}
    </div>
  );
}

function renderEmpty(title: string, text: string): ReactElement {
  return (
    <div className="history-list__empty">
      <b>{title}</b>
      {text}
    </div>
  );
}
