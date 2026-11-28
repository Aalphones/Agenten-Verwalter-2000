import { useEffect, useState } from 'react';
import type { UnlistenFn } from '@tauri-apps/api/event';
import { onReportChanged, tidyingPhases } from '@/lib/report';

const NOTHING_TIDYING: readonly string[] = [];

interface StoredTidying {
  owner: string;
  phaseIds: readonly string[];
}

/** Die Phasen der Umsetzung, die Haiku gerade ordnet; `[]` ohne Umsetzung. */
export function useReportTidying(implementationId: string | null): readonly string[] {
  const [stored, setStored] = useState<StoredTidying | null>(null);

  useEffect(() => {
    if (implementationId === null) {
      return undefined;
    }
    const id: string = implementationId;
    const controller = new AbortController();
    let unlisten: UnlistenFn | null = null;
    // Ein Ereignis ist neuer als die Antwort auf die erste Abfrage.
    let hasEvent = false;

    function readStart(): void {
      tidyingPhases(id)
        .then((phaseIds: string[]) => {
          if (!controller.signal.aborted && !hasEvent) {
            setStored({ owner: id, phaseIds });
          }
        })
        .catch((reason: unknown) => {
          console.error('Laufende Ordnungen nicht lesbar', reason);
        });
    }

    // Erst abonnieren, dann lesen: so fällt kein Ende zwischen beide.
    onReportChanged((changedId: string, phaseIds: string[]) => {
      if (changedId === id) {
        hasEvent = true;
        setStored({ owner: id, phaseIds });
      }
    })
      .then((stop: UnlistenFn) => {
        if (controller.signal.aborted) {
          stop();
          return;
        }
        unlisten = stop;
        readStart();
      })
      .catch((reason: unknown) => {
        console.error('Bericht-Ereignisse nicht abonnierbar', reason);
      });

    return (): void => {
      controller.abort();
      unlisten?.();
    };
  }, [implementationId]);

  if (stored === null || stored.owner !== implementationId) {
    return NOTHING_TIDYING;
  }
  return stored.phaseIds;
}
