import { useCallback, useEffect, useRef, useState } from 'react';

export type CopyState = 'idle' | 'copied' | 'failed';

const COPY_FEEDBACK_MS = 1500;

export interface CopyFeedback {
  state: CopyState;
  copy: (text: string) => void;
}

/** Schreibt Text in die Zwischenablage und meldet 1,5 s lang, ob es geklappt hat. */
export function useCopyFeedback(): CopyFeedback {
  const [state, setState] = useState<CopyState>('idle');
  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return (): void => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const copy = useCallback((text: string): void => {
    navigator.clipboard
      .writeText(text)
      .then(() => 'copied' as const)
      .catch(() => 'failed' as const)
      .then((outcome: CopyState) => {
        setState(outcome);
        if (resetTimerRef.current !== null) {
          window.clearTimeout(resetTimerRef.current);
        }
        resetTimerRef.current = window.setTimeout((): void => {
          setState('idle');
          resetTimerRef.current = null;
        }, COPY_FEEDBACK_MS);
      })
      .catch((reason: unknown) => {
        console.error('Kopieren nicht rückmeldbar', reason);
      });
  }, []);

  return { state, copy };
}
