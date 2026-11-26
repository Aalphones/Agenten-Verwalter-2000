import { useCallback, useId, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import type { StopHandle } from '@/features/changes/stopNavigation';
import { PLACE_LABELS } from '@/features/files/buildSessionRows';
import { FileActions } from '@/features/files/FileActions';
import { folderOf, nameOf } from '@/features/files/fileFacts';
import { FileMeta } from '@/features/files/FileMeta';
import { kindOfPath, viewModeFor } from '@/features/files/fileTypes';
import { FileContentView } from '@/features/files/FileViewer';
import { FilesSegment } from '@/features/files/FilesSegment';
import type { SegmentOption } from '@/features/files/FilesSegment';
import type { ArtifactKind } from '@/lib/bindings/ArtifactKind';
import type { FileRef } from '@/lib/bindings/FileRef';
import type { SessionFile } from '@/lib/bindings/SessionFile';
import type { SessionFileGroup } from '@/lib/bindings/SessionFileGroup';
import { isExecutablePath } from '@/lib/fileLinks';
import { openFileDefault } from '@/lib/sessionFiles';
import { useActionError } from '@/lib/useActionError';

type TextOrPreview = 'text' | 'preview';

const PREVIEW_OPTIONS: readonly SegmentOption<TextOrPreview>[] = [
  { value: 'text', label: 'Text', title: 'Den Text der Datei zeigen' },
  { value: 'preview', label: 'Vorschau', title: 'Die Datei im Betrachter zeigen' },
];

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
  /** Schalter „Vorschau“ dieser Datei (flüchtig, im Store der Ansicht). */
  preview: boolean;
  onPreview: (preview: boolean) => void;
}

/** „erstellt von #3“, „verlinkt von #3“ oder „im Scratchpad von #3“; ohne Gruppe oder Eintrag nichts. */
function originText(
  group: SessionFileGroup | undefined,
  file: SessionFile | undefined,
): string | null {
  if (group === undefined || file === undefined) {
    return null;
  }
  const number = `#${String(group.number)}`;
  if (file.written) {
    return `erstellt von ${number}`;
  }
  return file.linked ? `verlinkt von ${number}` : `im Scratchpad von ${number}`;
}

/** Eine offene Datei aus dem Knoten „Session-Dateien“: Pfadkette, vier Knöpfe, Metazeile und der Inhalt je Typ. */
export function SessionFileViewer({
  sessionId,
  path,
  line,
  group,
  file,
  onOverview,
  preview,
  onPreview,
}: SessionFileViewerProps): ReactElement {
  const handleRef = useRef<StopHandle>(null);
  const lockId: string = useId();
  const [isMissing, setIsMissing] = useState(false);
  const { error: actionError, run } = useActionError(path);
  // Ohne Änderungs-Markierungen gibt es keine Stellen, die jemand anzeigt.
  const ignorePosition = useCallback((): void => undefined, []);

  const name: string = file?.name ?? nameOf(path);
  const kind: ArtifactKind = file?.kind ?? kindOfPath(path);
  const executable: boolean = file?.executable ?? isExecutablePath(path);
  const isGone: boolean = (file !== undefined && !file.exists) || isMissing;
  const fileRef: FileRef = { kind: 'absolute', path };
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
        file={fileRef}
        kind={kind}
        preview={preview}
        bytes={file?.bytes ?? null}
        modifiedAt={file?.modifiedAt ?? null}
        entry={undefined}
        change={undefined}
        changedAt={file?.modifiedAt ?? 0}
        scope="all"
        highlightLine={line}
        handle={handleRef}
        onPosition={ignorePosition}
        onMissing={setIsMissing}
        onOpenDefault={(): void => {
          run(() => openFileDefault(sessionId, fileRef), 'Öffnen fehlgeschlagen');
        }}
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
        {viewModeFor('session', kind) === 'preview' && !isGone && (
          <FilesSegment
            label="Text oder Vorschau"
            options={PREVIEW_OPTIONS}
            value={preview ? 'preview' : 'text'}
            onChange={(next: TextOrPreview): void => {
              onPreview(next === 'preview');
            }}
          />
        )}
        <span className="file-viewer__actions">
          <FileActions
            sessionId={sessionId}
            file={fileRef}
            copyText={path}
            executable={executable}
            lockId={lockId}
            isGone={isGone}
            topLine={(): number | null => handleRef.current?.topLine() ?? null}
            run={run}
          />
        </span>
      </div>
      <FileMeta
        folder={folderOf(file?.path ?? path)}
        bytes={file?.bytes ?? null}
        modifiedAt={file?.modifiedAt ?? null}
        origin={originText(group, file)}
        executable={executable}
        lockId={lockId}
      />
      {actionError !== null && <p className="file-viewer__error">{actionError}</p>}
      {renderBody()}
    </div>
  );
}
