import { useEffect, useState } from 'react';
import type { UnlistenFn } from '@tauri-apps/api/event';
import type { ReportView } from '@/lib/bindings/ReportView';
import { commandErrorText } from '@/lib/errors';
import { loadReport, onReportChanged } from '@/lib/report';

export interface ReportState {
  /** Der letzte gelesene Bericht; bleibt beim Nachladen stehen, bis die neue Antwort da ist. */
  report: ReportView | null;
  /** Satz zum Lade- oder Abo-Fehler; `null` ohne Fehler. */
  error: string | null;
}

interface StoredReport {
  owner: string | null;
  report: ReportView | null;
  error: string | null;
}

/** Der Bericht einer Umsetzung. Neu gelesen wird bei `report://changed` für dieselbe Umsetzung; eine ältere
 *  Antwort überschreibt keine neuere. */
export function useReport(implementationId: string | null): ReportState {
  // Der Stand trägt die Umsetzung, zu der er gehört: nach einem Wechsel zeigt er sich sofort leer, ohne im Effekt
  // zurückgesetzt zu werden.
  const [stored, setStored] = useState<StoredReport>({ owner: null, report: null, error: null });

  useEffect(() => {
    if (implementationId === null) {
      return undefined;
    }
    const id: string = implementationId;
    const controller = new AbortController();
    let unlisten: UnlistenFn | null = null;
    let latestRequest = 0;

    function read(): void {
      latestRequest += 1;
      const request: number = latestRequest;
      loadReport(id)
        .then((view: ReportView) => {
          if (controller.signal.aborted || request !== latestRequest) {
            return;
          }
          setStored({ owner: id, report: view, error: null });
        })
        .catch((reason: unknown) => {
          console.error('Review-Bericht nicht lesbar', reason);
          if (!controller.signal.aborted && request === latestRequest) {
            const message: string = `Der Bericht ließ sich nicht lesen: ${commandErrorText(reason)}`;
            setStored((current: StoredReport) => ({
              owner: id,
              report: current.owner === id ? current.report : null,
              error: message,
            }));
          }
        });
    }

    read();
    onReportChanged((changedId: string) => {
      if (changedId === id) {
        read();
      }
    })
      .then((stop: UnlistenFn) => {
        if (controller.signal.aborted) {
          stop();
          return;
        }
        unlisten = stop;
      })
      .catch((reason: unknown) => {
        console.error('Bericht-Ereignisse nicht abonnierbar', reason);
      });

    return (): void => {
      controller.abort();
      unlisten?.();
    };
  }, [implementationId]);

  if (stored.owner !== implementationId) {
    return { report: null, error: null };
  }
  return { report: stored.report, error: stored.error };
}
