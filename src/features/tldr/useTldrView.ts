import { useEffect, useRef, useState } from 'react';
import type { UnlistenFn } from '@tauri-apps/api/event';
import type { TldrChangedEvent } from '@/lib/bindings/TldrChangedEvent';
import { commandErrorText } from '@/lib/errors';
import { onTldrChanged } from '@/lib/tldr';

export interface TldrViewState<T> {
  view: T | null;
  error: string | null;
}

interface LoadedState<T> extends TldrViewState<T> {
  key: string;
}

const NOTHING: TldrViewState<never> = { view: null, error: null };

/** Lädt eine TL;DR-Sicht beim Wählen und nach jedem `tldr://changed`, das `isRelevant` für diesen Schlüssel annimmt.
 *  `load` und `isRelevant` müssen stabile Funktionen sein (Modulebene). */
export function useTldrView<T>(
  key: string,
  load: (key: string) => Promise<T>,
  isRelevant: (event: TldrChangedEvent, key: string) => boolean,
): TldrViewState<T> {
  const [state, setState] = useState<LoadedState<T> | null>(null);
  const requestRef = useRef<number>(0);

  useEffect(() => {
    const controller = new AbortController();
    let unlisten: UnlistenFn | null = null;

    // Nur die jüngste Antwort zählt: Ereignisse und Wechsel lassen Ladevorgänge überlappen.
    function reload(): void {
      requestRef.current += 1;
      const request: number = requestRef.current;
      load(key)
        .then((view: T) => {
          if (!controller.signal.aborted && requestRef.current === request) {
            setState({ key, view, error: null });
          }
        })
        .catch((reason: unknown) => {
          if (controller.signal.aborted || requestRef.current !== request) {
            return;
          }
          // Der letzte gute Stand desselben Schlüssels bleibt stehen, der Fehler kommt dazu.
          setState((current: LoadedState<T> | null) => ({
            key,
            view: current?.key === key ? current.view : null,
            error: commandErrorText(reason),
          }));
        });
    }

    // Erst abonnieren, dann laden: eine Änderung zwischen Stand und Abo ginge sonst verloren.
    onTldrChanged((event: TldrChangedEvent) => {
      if (isRelevant(event, key)) {
        reload();
      }
    })
      .then((stop: UnlistenFn) => {
        if (controller.signal.aborted) {
          stop();
          return;
        }
        unlisten = stop;
        reload();
      })
      .catch((reason: unknown) => {
        console.error('TL;DR-Ereignisse nicht abonnierbar', reason);
      });

    return (): void => {
      controller.abort();
      if (unlisten !== null) {
        unlisten();
      }
    };
  }, [key, load, isRelevant]);

  if (state === null || state.key !== key) {
    return NOTHING;
  }
  return { view: state.view, error: state.error };
}
