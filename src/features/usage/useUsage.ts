import { useEffect, useRef, useState } from 'react';
import type { UnlistenFn } from '@tauri-apps/api/event';
import type { UsageStatus } from '@/lib/bindings/UsageStatus';
import { loadUsage, onUsageChanged, refreshUsage } from '@/lib/usage';

const REFRESH_INTERVAL_MS = 300_000;

function requestRefresh(force: boolean): void {
  refreshUsage(force).catch((reason: unknown) => {
    console.error('Kontingent nicht abrufbar', reason);
  });
}

/** Das Kontingent des Abos: beim Einhängen geladen und angefragt, bei jedem `usage://changed`
 *  nachgeladen, beim Öffnen des Fensters und alle 5 Minuten neu angefragt (nur bei sichtbarem Fenster). */
export function useUsage(isOpen: boolean): UsageStatus | null {
  const [status, setStatus] = useState<UsageStatus | null>(null);
  const requestRef = useRef<number>(0);

  useEffect(() => {
    const controller = new AbortController();
    let unlisten: UnlistenFn | null = null;

    // Nur die jüngste Antwort zählt: Ereignisse und Einhängen lassen Ladevorgänge überlappen.
    function load(): void {
      requestRef.current += 1;
      const request: number = requestRef.current;
      loadUsage()
        .then((loaded: UsageStatus) => {
          if (!controller.signal.aborted && requestRef.current === request) {
            setStatus(loaded);
          }
        })
        .catch((reason: unknown) => {
          console.error('Kontingent nicht ladbar', reason);
        });
    }

    // Erst abonnieren, dann anfragen: das Ende des Abrufs käme sonst womöglich vor dem Abo.
    onUsageChanged(load)
      .then((stop: UnlistenFn) => {
        if (controller.signal.aborted) {
          stop();
          return;
        }
        unlisten = stop;
        load();
        requestRefresh(false);
      })
      .catch((reason: unknown) => {
        console.error('Kontingent-Ereignisse nicht abonnierbar', reason);
      });

    return (): void => {
      controller.abort();
      if (unlisten !== null) {
        unlisten();
      }
    };
  }, []);

  useEffect(() => {
    const timer: number = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        requestRefresh(false);
      }
    }, REFRESH_INTERVAL_MS);
    return (): void => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      requestRefresh(false);
    }
  }, [isOpen]);

  return status;
}
