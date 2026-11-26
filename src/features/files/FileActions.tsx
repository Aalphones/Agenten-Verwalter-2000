import { useState } from 'react';
import type { ReactElement } from 'react';
import type { FileRef } from '@/lib/bindings/FileRef';
import { openFileDefault, openFileInEditor, revealFile } from '@/lib/sessionFiles';
import './FileActions.css';

const COPIED_TEXT = 'Pfad kopiert';
const COPIED_DURATION_MS = 2000;
const GONE_TITLE = 'Die Datei gibt es nicht mehr';

interface FileActionsProps {
  sessionId: string;
  file: FileRef;
  /** Was „Pfad kopieren“ in die Zwischenablage legt: bei Session-Dateien der absolute Pfad, im Repository der
   *  Pfad im Eintrag. */
  copyText: string;
  /** „Mit Standardprogramm öffnen“ ist gesperrt; `lockId` nennt die Zeile mit dem Grund. */
  executable: boolean;
  lockId: string;
  /** Die Datei gibt es nicht mehr: nur „Pfad kopieren“ bleibt. */
  isGone: boolean;
  /** Oberste sichtbare Zeile für VS Code; `null` ohne Zeile. */
  topLine: () => number | null;
  /** Führt eine Aktion aus und zeigt ihren Fehler in der Ansicht (`useActionError`). */
  run: (action: () => Promise<void>, prefix?: string) => void;
}

/** Die vier Knöpfe jeder Datei: In VS Code öffnen, Im Dateisystem anzeigen, Mit Standardprogramm öffnen, Pfad
 *  kopieren. In einem Detailbereich unter 600 px (Container-Abfrage `file-detail`) stehen die Kurzformen. */
export function FileActions({
  sessionId,
  file,
  copyText,
  executable,
  lockId,
  isGone,
  topLine,
  run,
}: FileActionsProps): ReactElement {
  const [copied, setCopied] = useState<string | null>(null);

  function copyPath(): void {
    navigator.clipboard
      .writeText(copyText)
      .then(() => {
        setCopied(copyText);
        window.setTimeout(() => {
          setCopied((current: string | null) => (current === copyText ? null : current));
        }, COPIED_DURATION_MS);
      })
      .catch((reason: unknown) => {
        console.error('Pfad kopieren fehlgeschlagen', reason);
      });
  }

  return (
    <>
      <button
        type="button"
        className="files-button files-button--small"
        title={isGone ? GONE_TITLE : 'In VS Code öffnen'}
        disabled={isGone}
        onClick={(): void => {
          run(() => openFileInEditor(sessionId, file, topLine()), 'VS Code öffnen fehlgeschlagen');
        }}
      >
        <span className="file-actions__long">In VS Code öffnen</span>
        <span className="file-actions__short">VS Code</span>
      </button>
      <button
        type="button"
        className="files-button files-button--small"
        title={isGone ? GONE_TITLE : 'Im Dateisystem anzeigen'}
        disabled={isGone}
        onClick={(): void => {
          run(() => revealFile(sessionId, file), 'Anzeigen fehlgeschlagen');
        }}
      >
        <span className="file-actions__long">Im Dateisystem anzeigen</span>
        <span className="file-actions__short">Ordner</span>
      </button>
      <button
        type="button"
        className="files-button files-button--small"
        title={isGone ? GONE_TITLE : 'Mit Standardprogramm öffnen'}
        disabled={isGone || executable}
        aria-describedby={executable ? lockId : undefined}
        onClick={(): void => {
          run(() => openFileDefault(sessionId, file), 'Öffnen fehlgeschlagen');
        }}
      >
        <span className="file-actions__long">Mit Standardprogramm öffnen</span>
        <span className="file-actions__short">Öffnen</span>
      </button>
      <button type="button" className="files-button files-button--small" onClick={copyPath}>
        Pfad kopieren
      </button>
      <span className="file-actions__status" role="status">
        {copied === copyText ? COPIED_TEXT : ''}
      </span>
    </>
  );
}
