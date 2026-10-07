import { useCallback, useEffect, useRef, useState } from 'react';
import type { UnlistenFn } from '@tauri-apps/api/event';
import { loadCliVersion, onCliUpdateChanged, startCliUpdate } from '@/lib/cliUpdate';
import type { CliVersionStatus } from '@/lib/bindings/CliVersionStatus';

interface CliVersionView {
  /** `null`, bis der erste Lesevorgang zurück ist. */
  status: CliVersionStatus | null;
  isLoading: boolean;
  /** Fragt die Versionen erneut ab. */
  check: () => void;
  update: () => void;
}

/** Version der Claude-Kommandozeile: beim Einhängen gelesen, bei jedem `cli-update://changed`
 *  (Anfang und Ende einer Aktualisierung) neu gelesen. */
export function useCliVersion(): CliVersionView {
  const [status, setStatus] = useState<CliVersionStatus | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const requestRef = useRef<number>(0);
  const isAliveRef = useRef<boolean>(true);

  // Nur die jüngste Antwort zählt: das Lesen dauert bis zu 15 s, Ereignisse überlappen es.
  const load = useCallback((): void => {
    requestRef.current += 1;
    const request: number = requestRef.current;
    setIsLoading(true);
    loadCliVersion()
      .then((loaded: CliVersionStatus) => {
        if (isAliveRef.current && requestRef.current === request) {
          setStatus(loaded);
          setIsLoading(false);
        }
      })
      .catch((reason: unknown) => {
        console.error('Version der Claude-Kommandozeile nicht ladbar', reason);
        if (isAliveRef.current && requestRef.current === request) {
          setIsLoading(false);
        }
      });
  }, []);

  useEffect(() => {
    isAliveRef.current = true;
    let unlisten: UnlistenFn | null = null;

    // Erst abonnieren, dann laden: das Ende der Aktualisierung käme sonst womöglich vor dem Abo.
    onCliUpdateChanged(load)
      .then((stop: UnlistenFn) => {
        if (!isAliveRef.current) {
          stop();
          return;
        }
        unlisten = stop;
        load();
      })
      .catch((reason: unknown) => {
        console.error('Update-Ereignisse nicht abonnierbar', reason);
      });

    return (): void => {
      isAliveRef.current = false;
      if (unlisten !== null) {
        unlisten();
      }
    };
  }, [load]);

  function update(): void {
    startCliUpdate().catch((reason: unknown) => {
      console.error('Aktualisierung nicht gestartet', reason);
    });
  }

  return { status, isLoading, check: load, update };
}
