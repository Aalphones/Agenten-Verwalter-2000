import type { ReactElement } from 'react';
import { EMPTY_SCOPE_TEXT, REACH_TEXT, trackedSinceText } from '@/features/changes/changesScope';
import { GitHistory } from '@/features/git/GitHistory';
import { syncText } from '@/features/git/gitTexts';
import type { ChangeScope } from '@/lib/bindings/ChangeScope';
import type { ChangesReach } from '@/lib/bindings/ChangesReach';
import type { FileChange } from '@/lib/bindings/FileChange';
import type { GitEntryStatus } from '@/lib/bindings/GitEntryStatus';
import type { GitSessionStatus } from '@/lib/bindings/GitSessionStatus';
import type { RepositoryChanges } from '@/lib/bindings/RepositoryChanges';
import type { SessionChanges } from '@/lib/bindings/SessionChanges';
import './ChangesOverview.css';

/** Der Git-Zustand der Session für die Übersicht: ↓/↑ je Zeile und der Verlauf. */
export interface OverviewGit {
  sessionId: string;
  status: GitSessionStatus;
  /** Das gewählte Repository, `null` = alle; der Verlauf gehört dem ersten sichtbaren. */
  repositoryFilter: string | null;
  onChanged: () => void;
}

interface ChangesOverviewProps {
  changes: SessionChanges;
  reach: ChangesReach;
  untrackedBefore: number | null;
  scope: ChangeScope;
  hasVisibleFiles: boolean;
  /** `null` ohne Git-Bedienung (Reichweite Projekt). */
  git: OverviewGit | null;
}

export function ChangesOverview({
  changes,
  reach,
  untrackedBefore,
  scope,
  hasVisibleFiles,
  git,
}: ChangesOverviewProps): ReactElement {
  return (
    <div className="changes-overview">
      <div className="changes-overview__head">
        <h2 className="changes-overview__title">Übersicht</h2>
        <p className="changes-overview__reach">{REACH_TEXT[reach]}</p>
        {untrackedBefore !== null && (
          <p className="changes-overview__reach">{trackedSinceText(untrackedBefore)}</p>
        )}
      </div>
      <div className="changes-overview__box">
        {changes.repositories.map((repository: RepositoryChanges) => (
          <div
            key={repository.key}
            className={`changes-overview__row${git === null ? '' : ' changes-overview__row--git'}`}
          >
            <span className="changes-overview__name">{repository.name}</span>
            <span className="changes-overview__branch">
              {repository.branch} ← {repository.baseRef}
            </span>
            {renderStatus(repository)}
            {git !== null && renderSync(entryOf(git, repository.key))}
          </div>
        ))}
        {changes.plainFolders.map((name: string, index: number) => (
          <div key={`folder:${String(index)}`} className="changes-overview__row">
            <span className="changes-overview__name">{name}</span>
            <span className="changes-overview__note">
              Ordner ohne Git — die App sieht hier keine Änderungen.
            </span>
          </div>
        ))}
      </div>
      {git !== null && renderHistory(changes, git)}
      <p className="changes-overview__hint">
        {hasVisibleFiles
          ? 'Wähle links eine Datei, um ihren Diff zu sehen.'
          : EMPTY_SCOPE_TEXT[scope]}
      </p>
    </div>
  );
}

function entryOf(git: OverviewGit, key: string): GitEntryStatus | undefined {
  return git.status.entries.find((entry: GitEntryStatus) => entry.key === key);
}

function renderSync(entry: GitEntryStatus | undefined): ReactElement | null {
  if (entry === undefined || entry.error !== null) {
    return null;
  }
  const isPending: boolean = entry.ahead > 0 || entry.behind > 0;
  return (
    <span
      className={`changes-overview__sync${isPending ? ' changes-overview__sync--pending' : ''}`}
    >
      {syncText(entry)}
    </span>
  );
}

/** Der Verlauf des ersten sichtbaren Repositorys mit lesbarem Git-Zustand. */
function renderHistory(changes: SessionChanges, git: OverviewGit): ReactElement | null {
  for (const repository of changes.repositories) {
    if (git.repositoryFilter !== null && repository.key !== git.repositoryFilter) {
      continue;
    }
    const entry: GitEntryStatus | undefined = entryOf(git, repository.key);
    if (entry === undefined || entry.error !== null) {
      return null;
    }
    return (
      <GitHistory
        key={entry.key}
        sessionId={git.sessionId}
        entry={entry}
        entryName={repository.name}
        isBusy={git.status.busy.length > 0}
        onChanged={git.onChanged}
      />
    );
  }
  return null;
}

function renderStatus(repository: RepositoryChanges): ReactElement {
  if (repository.error !== null) {
    return (
      <span className="changes-overview__error" role="alert">
        {repository.error}
      </span>
    );
  }
  const uncommitted: number = repository.files.filter(
    (file: FileChange) => file.uncommitted !== null,
  ).length;
  return (
    <>
      <span className="changes-overview__muted">
        {repository.commitCount === 1 ? '1 Commit' : `${String(repository.commitCount)} Commits`}
      </span>
      <span className="changes-overview__muted">
        {uncommitted === 0 ? 'alles committed' : `${String(uncommitted)} uncommitted`}
      </span>
    </>
  );
}
