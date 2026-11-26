import { useCallback, useRef } from 'react';
import type { ReactElement } from 'react';
import type { StopHandle } from '@/features/changes/stopNavigation';
import { PLACE_LABELS } from '@/features/files/buildSessionRows';
import { FileContentView } from '@/features/files/FileViewer';
import type { SessionFile } from '@/lib/bindings/SessionFile';
import type { SessionFileGroup } from '@/lib/bindings/SessionFileGroup';

interface SessionFileViewerProps {
  /** Session, über die der Core die Datei liest. */
  sessionId: string;
  /** Absoluter Pfad der Datei. */
  path: string;
  line: number | null;
  /** Gruppe, unter der die Datei gewählt wurde; `undefined`, solange die Liste fehlt. */
  group: SessionFileGroup | undefined;
  /** Eintrag der Liste; `undefined`, solange sie fehlt oder die Datei nicht mehr führt. */
  file: SessionFile | undefined;
  onOverview: () => void;
}

function nameOf(path: string): string {
  return path.slice(Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1);
}

function folderOf(path: string): string {
  return path.slice(0, Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'), 0));
}

/** Eine offene Datei aus dem Knoten „Session-Dateien“: Pfadkette und Inhalt als Text. */
export function SessionFileViewer({
  sessionId,
  path,
  line,
  group,
  file,
  onOverview,
}: SessionFileViewerProps): ReactElement {
  const handleRef = useRef<StopHandle>(null);
  // Ohne Änderungs-Markierungen gibt es keine Stellen, die jemand anzeigt.
  const ignorePosition = useCallback((): void => undefined, []);

  const name: string = file?.name ?? nameOf(path);
  const crumbs: string[] = ['Session-Dateien'];
  if (group !== undefined) {
    crumbs.push(`#${String(group.number)}`);
  }
  if (file !== undefined) {
    crumbs.push(PLACE_LABELS[file.origin]);
  }

  function renderBody(): ReactElement {
    if (file !== undefined && !file.exists) {
      const reason: string = file.linked ? 'im Chat verlinkt' : 'geschrieben';
      return (
        <div className="file-viewer__hint">
          <b>Datei gibt es nicht mehr</b>
          <span>
            Sie lag in {folderOf(path)}. Die Session hat sie {reason}; gelöscht wurde sie danach.
          </span>
        </div>
      );
    }
    return (
      <FileContentView
        key={path}
        source="session"
        sessionId={sessionId}
        reach="project"
        entryKey=""
        path={path}
        entry={undefined}
        change={undefined}
        changedAt={file?.modifiedAt ?? 0}
        scope="all"
        highlightLine={line}
        handle={handleRef}
        onPosition={ignorePosition}
      />
    );
  }

  return (
    <div className="file-viewer">
      <div className="file-viewer__head">
        <button
          type="button"
          className="files-button files-button--small"
          title="Zurück zur Übersicht mit Verlauf (Esc)"
          onClick={onOverview}
        >
          ← Übersicht
        </button>
        <span className="file-viewer__crumbs" title={path}>
          {crumbs.map((crumb: string) => (
            <span key={crumb} className="file-viewer__crumb-part">
              <span className="file-viewer__crumb-text">{crumb}</span>
              <span className="file-viewer__slash" aria-hidden="true">
                /
              </span>
            </span>
          ))}
          <b className="file-viewer__file-name">{name}</b>
        </span>
      </div>
      {renderBody()}
    </div>
  );
}
