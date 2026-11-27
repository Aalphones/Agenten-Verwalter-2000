import { useCallback, useRef, useState } from 'react';
import { ACCEPT_RESULT, ACCEPT_UNDO_MS } from '@/features/report/reportTexts';
import { completeStationByUser } from '@/lib/implementation';
import { useActionError } from '@/lib/useActionError';

const ACCEPT_FAILED_PREFIX = 'Abnehmen fehlgeschlagen';

export interface ReportAccept {
  /** Nach „Abnehmen“ läuft der Hinweis mit „Rückgängig“; die Abnahme geschieht erst, wenn er abläuft. */
  isPending: boolean;
  /** Fehlersatz der Abnahme. */
  error: string | null;
  accept: () => void;
  undo: () => void;
}

/**
 * „Abnehmen“ im Review-Bericht: schließt die Abnahme-Station mit dem Ergebnis „Abgenommen im Review-Bericht“,
 * aber erst nach einer Schonfrist, in der „Rückgängig“ gilt.
 */
export function useReportAccept(implementationId: string, stationId: string | null): ReportAccept {
  const [isPending, setIsPending] = useState<boolean>(false);
  const timer = useRef<number | null>(null);
  const { error, run } = useActionError(`accept:${implementationId}`);

  const accept = useCallback((): void => {
    if (stationId === null || timer.current !== null) {
      return;
    }
    setIsPending(true);
    // Der Timer überlebt den Wechsel in eine andere Ansicht: der Hinweis hat „Abgenommen“ gesagt.
    timer.current = window.setTimeout((): void => {
      timer.current = null;
      run(async (): Promise<void> => {
        try {
          await completeStationByUser(implementationId, stationId, ACCEPT_RESULT);
        } finally {
          setIsPending(false);
        }
      }, ACCEPT_FAILED_PREFIX);
    }, ACCEPT_UNDO_MS);
  }, [implementationId, stationId, run]);

  const undo = useCallback((): void => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    setIsPending(false);
  }, []);

  return { isPending, error, accept, undo };
}
