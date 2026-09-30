import { useEffect, useRef, useState } from 'react';
import type { UnlistenFn } from '@tauri-apps/api/event';
import type { ContextChangedEvent } from '@/lib/bindings/ContextChangedEvent';
import type { SessionContext } from '@/lib/bindings/SessionContext';
import { loadContext, onContextChanged, refreshContext } from '@/lib/context';

interface LoadedContext {
  sessionId: string;
  context: SessionContext;
}

/** Die Kontext-Aufschlüsselung der Session, solange ihr Fenster offen ist: beim Öffnen wird der Agent
 *  um einen frischen Stand gebeten, danach lädt jedes `context://changed` dieser Session nach. */
export function useSessionContext(sessionId: string, isOpen: boolean): SessionContext | null {
  const [loaded, setLoaded] = useState<LoadedContext | null>(null);
  const requestRef = useRef<number>(0);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const controller = new AbortController();
    let unlisten: UnlistenFn | null = null;

    // Nur die jüngste Antwort zählt: Ereignisse und Öffnen lassen Ladevorgänge überlappen.
    function load(): void {
      requestRef.current += 1;
      const request: number = requestRef.current;
      loadContext(sessionId)
        .then((context: SessionContext) => {
          if (!controller.signal.aborted && requestRef.current === request) {
            setLoaded({ sessionId, context });
          }
        })
        .catch((reason: unknown) => {
          console.error('Kontext nicht ladbar', reason);
        });
    }

    // Erst abonnieren, dann anfragen: die Antwort des Agenten käme sonst vor dem Abo.
    onContextChanged((event: ContextChangedEvent) => {
      if (event.sessionId === sessionId) {
        load();
      }
    })
      .then((stop: UnlistenFn) => {
        if (controller.signal.aborted) {
          stop();
          return;
        }
        unlisten = stop;
        refreshContext(sessionId).catch((reason: unknown) => {
          console.error('Kontext nicht anfragbar', reason);
        });
        load();
      })
      .catch((reason: unknown) => {
        console.error('Kontext-Ereignisse nicht abonnierbar', reason);
      });

    return (): void => {
      controller.abort();
      if (unlisten !== null) {
        unlisten();
      }
    };
  }, [sessionId, isOpen]);

  if (loaded === null || loaded.sessionId !== sessionId) {
    return null;
  }
  return loaded.context;
}
