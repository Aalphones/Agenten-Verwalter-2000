import { useEffect, useRef, useState } from 'react';
import type { UnlistenFn } from '@tauri-apps/api/event';
import type { BackgroundChangedEvent } from '@/lib/bindings/BackgroundChangedEvent';
import type { SessionBackground } from '@/lib/bindings/SessionBackground';
import { loadBackground, onBackgroundChanged } from '@/lib/background';

interface LoadedState {
  sessionId: string;
  background: SessionBackground;
}

/** Befehle, Prozesse und Subagenten der Session ohne Ausgaben: beim Wählen und bei jedem `background://changed`
 *  dieser Session. Der Verlauf (Zeilen, Dauern) braucht die Daten;
 *  nach einem Ladefehler bleibt der letzte gute Stand derselben Session stehen. */
export function useSessionBackground(sessionId: string | null): SessionBackground | null {
  const [state, setState] = useState<LoadedState | null>(null);
  const requestRef = useRef<number>(0);

  useEffect(() => {
    if (sessionId === null) {
      return undefined;
    }
    const currentId: string = sessionId;
    const controller = new AbortController();
    let unlisten: UnlistenFn | null = null;

    // Nur die jüngste Antwort zählt: Ereignisse und Session-Wechsel lassen Ladevorgänge überlappen.
    function load(): void {
      requestRef.current += 1;
      const request: number = requestRef.current;
      loadBackground(currentId)
        .then((background: SessionBackground) => {
          if (!controller.signal.aborted && requestRef.current === request) {
            setState({ sessionId: currentId, background });
          }
        })
        .catch((reason: unknown) => {
          console.error('Hintergrund nicht ladbar', reason);
        });
    }

    // Erst abonnieren, dann laden: eine Änderung zwischen Stand und Abo ginge sonst verloren.
    onBackgroundChanged((event: BackgroundChangedEvent) => {
      if (event.sessionId === currentId) {
        load();
      }
    })
      .then((stop: UnlistenFn) => {
        if (controller.signal.aborted) {
          stop();
          return;
        }
        unlisten = stop;
        load();
      })
      .catch((reason: unknown) => {
        console.error('Hintergrund-Ereignisse nicht abonnierbar', reason);
      });

    return (): void => {
      controller.abort();
      if (unlisten !== null) {
        unlisten();
      }
    };
  }, [sessionId]);

  if (state === null || state.sessionId !== sessionId) {
    return null;
  }
  return state.background;
}
