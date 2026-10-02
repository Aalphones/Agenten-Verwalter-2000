import type { ReactElement } from 'react';
import { EMPTY_SCOPE_TEXT, REACH_TEXT, trackedSinceText } from '@/features/changes/changesScope';
import type { ChangeScope } from '@/lib/bindings/ChangeScope';
import type { ChangesReach } from '@/lib/bindings/ChangesReach';
import type { FileChange } from '@/lib/bindings/FileChange';
import type { RepositoryChanges } from '@/lib/bindings/RepositoryChanges';
import type { SessionChanges } from '@/lib/bindings/SessionChanges';
import './ChangesOverview.css';

interface ChangesOverviewProps {
  changes: SessionChanges;
  reach: ChangesReach;
  untrackedBefore: number | null;
  scope: ChangeScope;
  hasVisibleFiles: boolean;
}

export function ChangesOverview({
  changes,
  reach,
  untrackedBefore,
  scope,
  hasVisibleFiles,
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
          <div key={repository.key} className="changes-overview__row">
            <span className="changes-overview__name">{repository.name}</span>
            <span className="changes-overview__branch">
              {repository.branch} ← {repository.baseRef}
            </span>
            {renderStatus(repository)}
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
      <p className="changes-overview__hint">
        {hasVisibleFiles
          ? 'Wähle links eine Datei, um ihren Diff zu sehen.'
          : EMPTY_SCOPE_TEXT[scope]}
      </p>
    </div>
  );
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
