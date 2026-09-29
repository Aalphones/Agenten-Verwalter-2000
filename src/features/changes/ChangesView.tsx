import { useMemo } from 'react';
import type { ReactElement } from 'react';
import { buildFileRows, type FileRow } from '@/features/changes/buildFileRows';
import { ChangesOverview } from '@/features/changes/ChangesOverview';
import { ChangesToolbar } from '@/features/changes/ChangesToolbar';
import { FileTree } from '@/features/changes/FileTree';
import type { ChangeScope } from '@/lib/bindings/ChangeScope';
import type { SessionChanges } from '@/lib/bindings/SessionChanges';
import type { SessionSummary } from '@/lib/bindings/SessionSummary';
import { DEFAULT_SELECTION, useChangesStore, type ChangesSelection } from '@/stores/changes';
import './ChangesView.css';

interface ChangesViewProps {
  session: SessionSummary;
  changes: SessionChanges | null;
  error: string | null;
}

export function ChangesView({ session, changes, error }: ChangesViewProps): ReactElement {
  const sessionId: string = session.id;
  const selection: ChangesSelection = useChangesStore(
    (state) => state.selections[sessionId] ?? DEFAULT_SELECTION,
  );
  const setRepositoryFilter = useChangesStore((state) => state.setRepositoryFilter);
  const setScope = useChangesStore((state) => state.setScope);
  const openFile = useChangesStore((state) => state.openFile);

  const rows: FileRow[] = useMemo(
    () =>
      changes === null ? [] : buildFileRows(changes, selection.repositoryFilter, selection.scope),
    [changes, selection.repositoryFilter, selection.scope],
  );

  if (changes === null) {
    return <p className="changes-view__notice">{error ?? 'Changes werden gelesen …'}</p>;
  }

  return (
    <div className="changes-view">
      <ChangesToolbar
        changes={changes}
        selection={selection}
        onRepositoryFilter={(position: number | null): void => {
          setRepositoryFilter(sessionId, position);
        }}
        onScope={(scope: ChangeScope): void => {
          setScope(sessionId, scope);
        }}
      />
      <div className="changes-view__body">
        <FileTree
          rows={rows}
          scope={selection.scope}
          openFile={selection.openFile}
          onOpen={(file): void => {
            openFile(sessionId, file);
          }}
        />
        <div className="changes-view__detail">
          <ChangesOverview
            changes={changes}
            scope={selection.scope}
            hasVisibleFiles={rows.some((row: FileRow) => row.kind === 'file')}
          />
        </div>
      </div>
    </div>
  );
}
