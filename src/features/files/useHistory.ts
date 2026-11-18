import { useEffect, useState } from 'react';
import type { ProjectHistory } from '@/lib/bindings/ProjectHistory';
import { commandErrorText } from '@/lib/errors';
import { loadHistory } from '@/lib/files';

export interface HistoryState {
  /** `null`, solange der Verlauf nicht gelesen ist. */
  history: ProjectHistory | null;
  error: string | null;
}

interface Loaded extends HistoryState {
  requestKey: string;
}

/** Liest den Verlauf des ganzen Vorhabens beim Öffnen des Reiters und erneut, sobald sich die Zahl der eigenen
 *  Commits in den Changes ändert (`commitStamp`). Der alte Verlauf bleibt bis zur Antwort stehen. */
export function useHistory(sessionId: string, commitStamp: number | null): HistoryState {
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (commitStamp === null) {
      return undefined;
    }
    const controller = new AbortController();
    loadHistory(sessionId)
      .then((history: ProjectHistory) => {
        if (!controller.signal.aborted) {
          setLoaded({ requestKey: sessionId, history, error: null });
        }
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setLoaded((current: Loaded | null) => ({
            requestKey: sessionId,
            history: current?.requestKey === sessionId ? current.history : null,
            error: commandErrorText(reason),
          }));
        }
      });
    return (): void => {
      controller.abort();
    };
  }, [sessionId, commitStamp]);

  if (loaded === null || loaded.requestKey !== sessionId) {
    return { history: null, error: null };
  }
  return { history: loaded.history, error: loaded.error };
}
