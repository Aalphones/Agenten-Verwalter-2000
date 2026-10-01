import { useEffect, useRef, useState } from 'react';
import type { BackgroundItem } from '@/lib/bindings/BackgroundItem';
import type { BackgroundKind } from '@/lib/bindings/BackgroundKind';
import type { BackgroundState } from '@/lib/bindings/BackgroundState';
import type { TextPreview } from '@/lib/bindings/TextPreview';
import { loadBackgroundOutput } from '@/lib/background';
import { commandErrorText } from '@/lib/errors';

const POLL_INTERVAL_MS = 2000;

export interface ItemOutput {
  preview: TextPreview | null;
  /** Satz, warum die Ausgabe nicht lädt; `null` ohne Fehler. */
  error: string | null;
}

interface LoadedOutput {
  sessionId: string;
  itemId: string;
  preview: TextPreview | null;
  error: string | null;
}

const NO_OUTPUT: ItemOutput = { preview: null, error: null };

/** Ausgabe des gewählten Befehls oder Prozesses. Ein laufender Prozess lädt alle 2 s nach; ein Subagent hat keine
 *  Ausgabe. Der Aufrufer rendert den Reiter nur, solange er sichtbar ist — damit endet der Takt mit dem Reiter. */
export function useItemOutput(sessionId: string, item: BackgroundItem | null): ItemOutput {
  const [loaded, setLoaded] = useState<LoadedOutput | null>(null);
  const requestRef = useRef<number>(0);

  const itemId: string | null = item === null ? null : item.id;
  const kind: BackgroundKind | null = item === null ? null : item.kind;
  const state: BackgroundState | null = item === null ? null : item.state;
  const hasOutput: boolean = kind === 'command' || kind === 'process';
  const isPolling: boolean = kind === 'process' && state === 'running';

  // `state` ist Abhängigkeit, damit die Ausgabe nach dem Ende des Prozesses ein letztes Mal geladen wird.
  useEffect(() => {
    if (itemId === null || !hasOutput) {
      return undefined;
    }
    const currentItemId: string = itemId;
    const controller = new AbortController();

    function load(): void {
      requestRef.current += 1;
      const request: number = requestRef.current;
      loadBackgroundOutput(sessionId, currentItemId)
        .then((preview: TextPreview) => {
          if (!controller.signal.aborted && requestRef.current === request) {
            setLoaded({ sessionId, itemId: currentItemId, preview, error: null });
          }
        })
        .catch((reason: unknown) => {
          console.error('Ausgabe nicht ladbar', reason);
          if (controller.signal.aborted || requestRef.current !== request) {
            return;
          }
          // Die zuletzt geladene Ausgabe desselben Eintrags bleibt stehen, der Fehler kommt dazu.
          setLoaded((current: LoadedOutput | null) => ({
            sessionId,
            itemId: currentItemId,
            preview:
              current?.sessionId === sessionId && current.itemId === currentItemId
                ? current.preview
                : null,
            error: `Ausgabe nicht ladbar: ${commandErrorText(reason)}`,
          }));
        });
    }

    load();
    let timer: number | null = null;
    if (isPolling) {
      timer = window.setInterval(load, POLL_INTERVAL_MS);
    }
    return (): void => {
      controller.abort();
      if (timer !== null) {
        window.clearInterval(timer);
      }
    };
  }, [sessionId, itemId, hasOutput, isPolling, state]);

  if (loaded === null || loaded.sessionId !== sessionId || loaded.itemId !== itemId) {
    return NO_OUTPUT;
  }
  return { preview: loaded.preview, error: loaded.error };
}
