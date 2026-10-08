import type { ReactElement } from 'react';
import type { ArchivedProject } from '@/lib/bindings/ArchivedProject';
import type { ArchiveSnippet } from '@/lib/bindings/ArchiveSnippet';
import { highlightSegments } from '@/features/archive/highlightSegments';
import type { HighlightSegment } from '@/features/archive/highlightSegments';
import './ArchiveCard.css';

export const RESTORE_INFO =
  'Holt das Vorhaben mit allen Sessions zurück in die Seitenleiste; der Agent startet erst mit deiner nächsten Nachricht';

interface ArchiveCardProps {
  project: ArchivedProject;
  /** Der Begriff, zu dem die Ausschnitte gehören; markiert die Fundstellen. */
  query: string;
  /** Ein Wiederherstellen läuft — der Knopf ist gesperrt. */
  isRestoring: boolean;
  onRestore: (projectId: string) => void;
}

function archivedOn(archivedAt: number): string {
  return new Date(archivedAt).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function metaLine(project: ArchivedProject): string {
  const sessions = `${String(project.sessionCount)} ${project.sessionCount === 1 ? 'Session' : 'Sessions'}`;
  const parts: string[] = [`archiviert am ${archivedOn(project.archivedAt)}`, sessions];
  if (project.repositoryNames.length > 0) {
    parts.push(project.repositoryNames.join(', '));
  }
  return parts.join(' · ');
}

function renderSegment(segment: HighlightSegment, index: number): ReactElement {
  if (segment.isMatch) {
    return (
      <mark key={index} className="archive-card__mark">
        {segment.text}
      </mark>
    );
  }
  return <span key={index}>{segment.text}</span>;
}

/** Ein archiviertes Vorhaben mit Fundstellen aus dem Chat und dem Knopf zum Wiederherstellen. */
export function ArchiveCard({
  project,
  query,
  isRestoring,
  onRestore,
}: ArchiveCardProps): ReactElement {
  return (
    <li className="archive-card">
      <div className="archive-card__body">
        <p className="archive-card__name">{project.name}</p>
        <p className="archive-card__meta">{metaLine(project)}</p>
        {project.snippets.length > 0 && (
          <ul className="archive-card__snippets">
            {project.snippets.map((snippet: ArchiveSnippet, index: number) => (
              <li key={index} className="archive-card__snippet">
                <span className="archive-card__session">{snippet.sessionName}</span>
                {highlightSegments(snippet.text, query).map(renderSegment)}
              </li>
            ))}
          </ul>
        )}
      </div>
      <button
        type="button"
        className="archive-card__restore"
        title={RESTORE_INFO}
        disabled={isRestoring}
        onClick={(): void => {
          onRestore(project.id);
        }}
      >
        Wiederherstellen
      </button>
    </li>
  );
}
