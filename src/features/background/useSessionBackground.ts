import { useEffect, useRef, useState } from 'react';
import type { UnlistenFn } from '@tauri-apps/api/event';
import type { BackgroundChangedEvent } from '@/lib/bindings/BackgroundChangedEvent';
import type { SessionBackground } from '@/lib/bindings/SessionBackground';
import { loadBackground, onBackgroundChanged } from '@/lib/background';
import { commandErrorText } from '@/lib/errors';

export interface SessionBackgroundState {
  background: SessionBackground | null;
  error: string | null;
}

interface LoadedState extends SessionBackgroundState {
  sessionId: string;
}

const NOTHING: SessionBackgroundState = { background: null, error: null };

/** Befehle, Prozesse und Subagenten der Session ohne Ausgaben: beim Wählen und bei jedem `background://changed`
 *  dieser Session. Läuft auch bei geschlossenem Panel, weil Kopfzeile (Zähler) und Verlauf (Zeilen) die Daten brauchen. */
export function useSessionBackground(sessionId: string | null): SessionBackgroundState {
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
            setState({ sessionId: currentId, background, error: null });
          }
        })
        .catch((reason: unknown) => {
          if (controller.signal.aborted || requestRef.current !== request) {
            return;
          }
          // Der letzte gute Stand derselben Session bleibt stehen, der Fehler kommt dazu.
          setState((current: LoadedState | null) => ({
            sessionId: currentId,
            background: current?.sessionId === currentId ? current.background : null,
            error: commandErrorText(reason),
          }));
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
    return NOTHING;
  }
  return { background: state.background, error: state.error };
}
