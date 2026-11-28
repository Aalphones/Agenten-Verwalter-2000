import { useEffect, useState } from 'react';
import type { UnlistenFn } from '@tauri-apps/api/event';
import { onReportChanged, reportOfSession } from '@/lib/report';

/** Die Umsetzung, deren Bericht die Session als Station zeigt; `null`, solange sie keine Station ist oder der Bericht
 *  noch leer ist. Liest nur die Zuordnung, nicht den Bericht selbst. */
export function useReportOfSession(sessionId: string | null, isStation: boolean): string | null {
  // Der Treffer trägt die Session, zu der er gehört: nach einem Wechsel gilt er nicht mehr, ohne im Effekt
  // zurückgesetzt zu werden.
  const [found, setFound] = useState<{ sessionId: string; implementationId: string | null } | null>(
    null,
  );

  useEffect(() => {
    if (sessionId === null || !isStation) {
      return undefined;
    }
    const id: string = sessionId;
    const controller = new AbortController();
    let unlisten: UnlistenFn | null = null;

    function read(): void {
      reportOfSession(id)
        .then((implementationId: string | null) => {
          if (!controller.signal.aborted) {
            setFound({ sessionId: id, implementationId });
          }
        })
        .catch((reason: unknown) => {
          console.error('Bericht der Session nicht lesbar', reason);
        });
    }

    read();
    // Der erste Eintrag oder die erste fertige Phase lässt den Reiter erscheinen.
    onReportChanged(() => {
      read();
    })
      .then((stop: UnlistenFn) => {
        if (controller.signal.aborted) {
          stop();
          return;
        }
        unlisten = stop;
      })
      .catch((reason: unknown) => {
        console.error('Bericht-Ereignisse nicht abonnierbar', reason);
      });

    return (): void => {
      controller.abort();
      unlisten?.();
    };
  }, [sessionId, isStation]);

  if (found === null || !isStation || found.sessionId !== sessionId) {
    return null;
  }
  return found.implementationId;
}
