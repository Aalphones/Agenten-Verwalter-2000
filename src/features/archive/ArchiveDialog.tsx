import { useState } from 'react';
import type { ChangeEvent, ReactElement } from 'react';
import { Dialog } from '@/components/Dialog';
import { ArchiveCard } from '@/features/archive/ArchiveCard';
import { useArchiveSearch } from '@/features/archive/useArchiveSearch';
import type { ArchiveSearch } from '@/features/archive/useArchiveSearch';
import type { ArchivedProject } from '@/lib/bindings/ArchivedProject';
import type { ProjectRestored } from '@/lib/bindings/ProjectRestored';
import { restoreProject } from '@/lib/archive';
import { useActionError } from '@/lib/useActionError';
import './ArchiveDialog.css';

const TITLE_ID = 'archive-dialog-title';
const SEARCH_INFO = 'Durchsucht Namen und Chat-Texte aller archivierten Vorhaben';
const MORE_INFO = 'Zeigt die nächsten 20 archivierten Vorhaben';

interface ArchiveDialogProps {
  /** Der Core sendet beim Wiederherstellen kein Ereignis — der Aufrufer trägt Vorhaben und Sessions in seine Listen ein. */
  onRestored: (restored: ProjectRestored) => void;
  onClose: () => void;
}

/** Durchsucht archivierte Vorhaben und stellt sie wieder her. */
export function ArchiveDialog({ onRestored, onClose }: ArchiveDialogProps): ReactElement {
  const search: ArchiveSearch = useArchiveSearch();
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const { error: restoreError, run } = useActionError('archive');

  function handleRestore(projectId: string): void {
    run(async (): Promise<void> => {
      setRestoringId(projectId);
      try {
        const restored: ProjectRestored = await restoreProject(projectId);
        search.removeItem(projectId);
        onRestored(restored);
      } finally {
        setRestoringId(null);
      }
    }, 'Wiederherstellen fehlgeschlagen');
  }

  function renderList(): ReactElement | null {
    if (search.items.length === 0) {
      if (search.isLoading || search.error !== null) {
        return null;
      }
      const text: string =
        search.shownQuery.trim() === '' ? 'Noch nichts archiviert.' : 'Nichts gefunden.';
      return <p className="archive-dialog__empty">{text}</p>;
    }
    return (
      <ul className="archive-dialog__list">
        {search.items.map((project: ArchivedProject) => (
          <ArchiveCard
            key={project.id}
            project={project}
            query={search.shownQuery}
            isRestoring={restoringId === project.id}
            onRestore={handleRestore}
          />
        ))}
      </ul>
    );
  }

  return (
    <Dialog labelledBy={TITLE_ID} className="archive-dialog" onClose={onClose}>
      <header className="archive-dialog__header">
        <h3 id={TITLE_ID} className="archive-dialog__title">
          Archiv
        </h3>
        <input
          type="search"
          className="archive-dialog__search"
          placeholder="Vorhaben und Chat-Inhalte durchsuchen"
          aria-label="Archiv durchsuchen"
          title={SEARCH_INFO}
          value={search.query}
          onChange={(event: ChangeEvent<HTMLInputElement>): void => {
            search.setQuery(event.target.value);
          }}
        />
      </header>
      <div className="archive-dialog__scroll">
        {renderList()}
        {search.hasMore && (
          <button
            type="button"
            className="archive-dialog__more"
            title={MORE_INFO}
            disabled={search.isLoading}
            onClick={search.loadMore}
          >
            Mehr laden
          </button>
        )}
        {search.isLoading && search.items.length === 0 && (
          <p className="archive-dialog__empty">Lädt …</p>
        )}
        {(search.error ?? restoreError) !== null && (
          <p className="archive-dialog__error" role="alert">
            {search.error ?? restoreError}
          </p>
        )}
      </div>
    </Dialog>
  );
}
