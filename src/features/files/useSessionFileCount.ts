import { useEffect, useRef, useState } from 'react';
import type { SessionFileGroup } from '@/lib/bindings/SessionFileGroup';
import type { SessionFilesListing } from '@/lib/bindings/SessionFilesListing';
import { listSessionFiles } from '@/lib/sessionFiles';

interface Counted {
  sessionId: string;
  count: number;
}

/** Zahl der Session-Dateien des Vorhabens, zu dem die Session gehört; lädt neu, wenn sich `sessionId` oder
 *  `stamp` ändert. `null` ohne Session und solange es für sie keine Antwort gibt. */
export function useSessionFileCount(sessionId: string | null, stamp: string): number | null {
  const [counted, setCounted] = useState<Counted | null>(null);
  const sequenceRef = useRef<number>(0);

  useEffect(() => {
    if (sessionId === null) {
      return;
    }
    sequenceRef.current += 1;
    const sequence: number = sequenceRef.current;
    listSessionFiles(sessionId)
      .then((listing: SessionFilesListing) => {
        if (sequence !== sequenceRef.current) {
          return;
        }
        const count: number = listing.groups.reduce(
          (sum: number, group: SessionFileGroup) => sum + group.files.length,
          0,
        );
        setCounted({ sessionId, count });
      })
      .catch((reason: unknown) => {
        console.error('Session-Dateien nicht gezählt', reason);
      });
    // `stamp` löst das Nachladen aus, ohne im Effekt gelesen zu werden.
  }, [sessionId, stamp]);

  if (counted === null || counted.sessionId !== sessionId) {
    return null;
  }
  return counted.count;
}
