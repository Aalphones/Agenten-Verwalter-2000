import { useMemo } from 'react';
import type { ReactElement } from 'react';
import { buildFileRows, type FileRow } from '@/features/changes/buildFileRows';
import { ChangesOverview } from '@/features/changes/ChangesOverview';
import { ChangesToolbar } from '@/features/changes/ChangesToolbar';
import { statOf } from '@/features/changes/changesScope';
import { DiffView } from '@/features/changes/DiffView';
import { FileTree } from '@/features/changes/FileTree';
import { fileDiffKey } from '@/features/changes/useFileDiff';
import type { ChangeScope } from '@/lib/bindings/ChangeScope';
import type { ChangesReach } from '@/lib/bindings/ChangesReach';
import type { FileChange } from '@/lib/bindings/FileChange';
import type { RepositoryChanges } from '@/lib/bindings/RepositoryChanges';
import type { SessionChanges } from '@/lib/bindings/SessionChanges';
import type { SessionSummary } from '@/lib/bindings/SessionSummary';
import {
  DEFAULT_SELECTION,
  useChangesStore,
  type ChangesSelection,
  type OpenFile,
} from '@/stores/changes';
import './ChangesView.css';

interface ChangesViewProps {
  session: SessionSummary;
  changes: SessionChanges | null;
  error: string | null;
  reach: ChangesReach;
}

interface OpenTarget {
  repository: RepositoryChanges;
  file: FileChange;
}

/** Die geöffnete Datei, sofern sie im gewählten Blickwinkel noch existiert; sonst zeigt die Ansicht die Übersicht. */
function findOpenTarget(
  changes: SessionChanges,
  openFile: OpenFile | null,
  scope: ChangeScope,
): OpenTarget | null {
  if (openFile === null) {
    return null;
  }
  const repository: RepositoryChanges | undefined = changes.repositories.find(
    (candidate: RepositoryChanges) => candidate.key === openFile.key,
  );
  const file: FileChange | undefined = repository?.files.find(
    (candidate: FileChange) => candidate.path === openFile.path,
  );
  if (repository === undefined || file === undefined || statOf(file, scope) === null) {
    return null;
  }
  return { repository, file };
}

export function ChangesView({ session, changes, error, reach }: ChangesViewProps): ReactElement {
  const sessionId: string = session.id;
  const selection: ChangesSelection = useChangesStore(
    (state) => state.selections[sessionId] ?? DEFAULT_SELECTION,
  );
  const setRepositoryFilter = useChangesStore((state) => state.setRepositoryFilter);
  const setScope = useChangesStore((state) => state.setScope);
  const openFile = useChangesStore((state) => state.openFile);
  const closeFile = useChangesStore((state) => state.closeFile);

  const rows: FileRow[] = useMemo(
    () =>
      changes === null ? [] : buildFileRows(changes, selection.repositoryFilter, selection.scope),
    [changes, selection.repositoryFilter, selection.scope],
  );

  const openTarget: OpenTarget | null = useMemo(
    () => (changes === null ? null : findOpenTarget(changes, selection.openFile, selection.scope)),
    [changes, selection.openFile, selection.scope],
  );

  if (changes === null) {
    return <p className="changes-view__notice">{error ?? 'Changes werden gelesen …'}</p>;
  }

  return (
    <div className="changes-view">
      <ChangesToolbar
        changes={changes}
        selection={selection}
        onRepositoryFilter={(key: string | null): void => {
          setRepositoryFilter(sessionId, key);
        }}
        onScope={(scope: ChangeScope): void => {
          setScope(sessionId, scope);
        }}
      />
      <div className="changes-view__body">
        <FileTree
          rows={rows}
          scope={selection.scope}
          openFile={openTarget === null ? null : selection.openFile}
          onOpen={(file): void => {
            openFile(sessionId, file);
          }}
        />
        <div className="changes-view__detail">
          {openTarget === null ? (
            <ChangesOverview
              changes={changes}
              reach={reach}
              untrackedBefore={changes.untrackedBefore}
              scope={selection.scope}
              hasVisibleFiles={rows.some((row: FileRow) => row.kind === 'file')}
            />
          ) : (
            <DiffView
              key={fileDiffKey(
                { key: openTarget.repository.key, path: openTarget.file.path },
                selection.scope,
              )}
              sessionId={sessionId}
              reach={reach}
              repository={openTarget.repository}
              file={openTarget.file}
              scope={selection.scope}
              onClose={(): void => {
                closeFile(sessionId);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
