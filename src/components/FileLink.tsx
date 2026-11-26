import type { MouseEvent, ReactElement, ReactNode } from 'react';
import { openFromLink } from '@/features/files/openFromLink';
import type { LinkSession } from '@/features/files/openFromLink';
import type { FileLinkTarget } from '@/lib/bindings/FileLinkTarget';
import { commandErrorText } from '@/lib/errors';
import { fileHrefOf, isExternalLink, openFileLink, resolveFileLink } from '@/lib/fileLinks';
import { useSessionErrorsStore } from '@/stores/sessionErrors';
import './FileLink.css';

interface FileLinkProps {
  session: LinkSession;
  path: string;
  children: ReactNode;
}

/** Dateiverweis im Chat: Dateien eines Repositorys und Session-Dateien öffnen in „Dateien“, Artefakte in
 *  „Artefakte“, HTML des Vorhabens im Standardprogramm. Wohin der Link führt und ob die Datei geöffnet werden darf,
 *  entscheidet erst der Core beim Klick. */
export function FileLink({ session, path, children }: FileLinkProps): ReactElement {
  const reportSessionError = useSessionErrorsStore((state) => state.report);
  const clearSessionError = useSessionErrorsStore((state) => state.clear);
  const { sessionId } = session;

  async function follow(): Promise<void> {
    const target: FileLinkTarget = await resolveFileLink(sessionId, path);
    if (target.kind === 'external') {
      await openFileLink(sessionId, path);
    } else {
      openFromLink(session, target);
    }
  }

  function open(event: MouseEvent<HTMLAnchorElement>): void {
    // Ohne preventDefault würde das App-Fenster selbst navigieren.
    event.preventDefault();
    follow()
      .then(() => {
        clearSessionError(sessionId);
      })
      .catch((reason: unknown) => {
        console.error('Datei nicht geöffnet', reason);
        reportSessionError(sessionId, `Datei nicht geöffnet: ${commandErrorText(reason)}`);
      });
  }

  const href: string | undefined = fileHrefOf(path);
  const isExternal: boolean = isExternalLink(path);
  const title: string = isExternal
    ? `Im Standardprogramm öffnen: ${path}`
    : `In Dateien öffnen: ${path}`;
  return (
    <a
      className="file-link"
      href={href}
      role={href === undefined ? 'link' : undefined}
      tabIndex={href === undefined ? 0 : undefined}
      title={title}
      onClick={open}
      onAuxClick={open}
      onKeyDown={(event) => {
        if (href === undefined && event.key === 'Enter') {
          event.currentTarget.click();
        }
      }}
    >
      {children}
      {isExternal && (
        <span className="file-link__external" aria-hidden="true">
          {' ↗'}
        </span>
      )}
    </a>
  );
}
