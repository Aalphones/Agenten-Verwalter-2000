import { useEffect, useRef, useState } from 'react';
import type { BackgroundItem } from '@/lib/bindings/BackgroundItem';
import type { BackgroundKind } from '@/lib/bindings/BackgroundKind';
import type { BackgroundState } from '@/lib/bindings/BackgroundState';
import type { TextPreview } from '@/lib/bindings/TextPreview';
import { loadBackgroundOutput } from '@/lib/background';

const POLL_INTERVAL_MS = 2000;

interface LoadedOutput {
  sessionId: string;
  itemId: string;
  preview: TextPreview;
}

/** Ausgabe des gewählten Befehls oder Prozesses. Ein laufender Prozess lädt alle 2 s nach; ein Subagent hat keine
 *  Ausgabe. Der Aufrufer rendert den Reiter nur, solange er sichtbar ist — damit endet der Takt mit dem Reiter. */
export function useItemOutput(sessionId: string, item: BackgroundItem | null): TextPreview | null {
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
            setLoaded({ sessionId, itemId: currentItemId, preview });
          }
        })
        .catch((reason: unknown) => {
          console.error('Ausgabe nicht ladbar', reason);
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
    return null;
  }
  return loaded.preview;
}
