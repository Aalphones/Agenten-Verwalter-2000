import { useEffect, useRef, useState } from 'react';
import type { UnlistenFn } from '@tauri-apps/api/event';
import type { UsageAlert } from '@/lib/bindings/UsageAlert';
import type { UsageStatus } from '@/lib/bindings/UsageStatus';
import { loadUsage, onUsageChanged } from '@/lib/usage';

/** Die Kontingent-Warnung der letzten Antwort (`null` ohne Warnung). Fragt nichts an: den Abruf
 *  und die Zahlen der Kopfzeile besorgt `useUsage`. */
export function useUsageAlert(): UsageAlert | null {
  const [alert, setAlert] = useState<UsageAlert | null>(null);
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
            setAlert(loaded.alert);
          }
        })
        .catch((reason: unknown) => {
          console.error('Kontingent-Warnung nicht ladbar', reason);
        });
    }

    onUsageChanged(load)
      .then((stop: UnlistenFn) => {
        if (controller.signal.aborted) {
          stop();
          return;
        }
        unlisten = stop;
        load();
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

  return alert;
}
