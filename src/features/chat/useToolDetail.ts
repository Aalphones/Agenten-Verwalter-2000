import { useEffect, useRef, useState } from 'react';
import type { ToolState } from '@/lib/bindings/ToolState';
import type { ToolDetail } from '@/lib/bindings/ToolDetail';
import { commandErrorText } from '@/lib/errors';
import { loadToolDetail } from '@/lib/toolDetails';

export interface ToolDetailResult {
  detail: ToolDetail | null;
  /** Satz, warum das Detail nicht lädt; `null` ohne Fehler. */
  error: string | null;
}

interface LoadedDetail {
  sessionId: string;
  toolUseId: string;
  detail: ToolDetail | null;
  error: string | null;
}

const NO_DETAIL: ToolDetailResult = { detail: null, error: null };

/** Eingabe und Ausgabe eines Aufrufs. Der Aufrufer rendert die Komponente nur, solange der Aufruf aufgeklappt
 *  ist — damit lädt nichts, bevor jemand aufklappt. Ändert sich `state` (der Aufruf endet), lädt der Hook einmal
 *  neu; es gibt kein Polling. */
export function useToolDetail(
  sessionId: string,
  toolUseId: string,
  state: ToolState,
): ToolDetailResult {
  const [loaded, setLoaded] = useState<LoadedDetail | null>(null);
  const requestRef = useRef<number>(0);

  useEffect(() => {
    const controller = new AbortController();
    requestRef.current += 1;
    const request: number = requestRef.current;

    loadToolDetail(sessionId, toolUseId)
      .then((detail: ToolDetail) => {
        if (!controller.signal.aborted && requestRef.current === request) {
          setLoaded({ sessionId, toolUseId, detail, error: null });
        }
      })
      .catch((reason: unknown) => {
        console.error('Werkzeug-Detail nicht ladbar', reason);
        if (controller.signal.aborted || requestRef.current !== request) {
          return;
        }
        // Das zuletzt geladene Detail desselben Aufrufs bleibt stehen, der Fehler kommt dazu.
        setLoaded((current: LoadedDetail | null) => ({
          sessionId,
          toolUseId,
          detail:
            current?.sessionId === sessionId && current.toolUseId === toolUseId
              ? current.detail
              : null,
          error: `Ausgabe nicht ladbar: ${commandErrorText(reason)}`,
        }));
      });

    return (): void => {
      controller.abort();
    };
    // `state` ist Abhängigkeit, damit ein Aufruf, der beim Aufklappen noch lief, nach seinem Ende neu lädt.
  }, [sessionId, toolUseId, state]);

  if (loaded === null || loaded.sessionId !== sessionId || loaded.toolUseId !== toolUseId) {
    return NO_DETAIL;
  }
  return { detail: loaded.detail, error: loaded.error };
}
