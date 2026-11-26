import { useCallback, useEffect, useRef, useState } from 'react';
import type { SessionFilesListing } from '@/lib/bindings/SessionFilesListing';
import { commandErrorText } from '@/lib/errors';
import { listSessionFiles } from '@/lib/sessionFiles';

export interface SessionFilesState {
  listing: SessionFilesListing | null;
  error: string | null;
  /** Für diese Session gibt es noch keine Antwort. */
  isLoading: boolean;
  /** Liest die Liste neu; `null`, wenn das scheitert (der Satz steht dann in `error`). */
  reload: () => Promise<SessionFilesListing | null>;
}

interface Loaded {
  sessionId: string;
  sequence: number;
  listing: SessionFilesListing | null;
  error: string | null;
}

/** Die Session-Dateien des Vorhabens; ändert sich `stamp` (Stempel der Changes), lädt die Liste neu und die
 *  bisherige bleibt bis zur Antwort stehen. */
export function useSessionFiles(sessionId: string, stamp: string): SessionFilesState {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const sequenceRef = useRef<number>(0);

  // Antworten werden nach ihrer Nummer übernommen statt beim nächsten Stempel verworfen: das Lesen dauert über
  // eine Sekunde, und während ein Agent arbeitet, ändert sich der Stempel öfter – sonst käme nie eine Liste an.
  const reload = useCallback((): Promise<SessionFilesListing | null> => {
    sequenceRef.current += 1;
    const sequence: number = sequenceRef.current;
    function isOutdated(current: Loaded | null): boolean {
      return current !== null && current.sequence > sequence;
    }
    return listSessionFiles(sessionId)
      .then((listing: SessionFilesListing) => {
        setLoaded((current: Loaded | null) =>
          isOutdated(current) ? current : { sessionId, sequence, listing, error: null },
        );
        return listing;
      })
      .catch((reason: unknown) => {
        console.error('Session-Dateien nicht gelesen', reason);
        setLoaded((current: Loaded | null) => {
          if (isOutdated(current)) {
            return current;
          }
          const kept = current?.sessionId === sessionId ? current.listing : null;
          return { sessionId, sequence, listing: kept, error: commandErrorText(reason) };
        });
        return null;
      });
  }, [sessionId]);

  useEffect(() => {
    void reload();
    // `stamp` löst das Nachladen aus, ohne im Effekt gelesen zu werden.
  }, [reload, stamp]);

  if (loaded === null || loaded.sessionId !== sessionId) {
    return { listing: null, error: null, isLoading: true, reload };
  }
  return { listing: loaded.listing, error: loaded.error, isLoading: false, reload };
}
