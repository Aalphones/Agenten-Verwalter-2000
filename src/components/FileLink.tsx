import type { MouseEvent, ReactElement, ReactNode } from 'react';
import { commandErrorText } from '@/lib/errors';
import { openFileLink } from '@/lib/fileLinks';
import { useSessionErrorsStore } from '@/stores/sessionErrors';
import './FileLink.css';

interface FileLinkProps {
  sessionId: string;
  path: string;
  children: ReactNode;
}

/** Dateiverweis im Chat: öffnet die Datei mit dem Standardprogramm. Ob sie existiert und geöffnet
 *  werden darf, entscheidet erst der Core beim Klick. */
export function FileLink({ sessionId, path, children }: FileLinkProps): ReactElement {
  const reportSessionError = useSessionErrorsStore((state) => state.report);
  const clearSessionError = useSessionErrorsStore((state) => state.clear);

  function open(event: MouseEvent<HTMLAnchorElement>): void {
    // Ohne preventDefault würde das App-Fenster selbst navigieren.
    event.preventDefault();
    openFileLink(sessionId, path)
      .then(() => {
        clearSessionError(sessionId);
      })
      .catch((reason: unknown) => {
        console.error('Datei nicht geöffnet', reason);
        reportSessionError(sessionId, `Datei nicht geöffnet: ${commandErrorText(reason)}`);
      });
  }

  return (
    <a className="file-link" href="#" title={`Öffnen: ${path}`} onClick={open} onAuxClick={open}>
      {children}
    </a>
  );
}
