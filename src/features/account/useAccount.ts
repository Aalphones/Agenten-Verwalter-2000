import { useEffect, useRef, useState } from 'react';
import type { UnlistenFn } from '@tauri-apps/api/event';
import { loadAccount, onAccountChanged, startAccountLogin } from '@/lib/account';
import type { AccountStatus } from '@/lib/bindings/AccountStatus';

interface AccountView {
  /** `null`, bis der erste Lesevorgang zurück ist. */
  status: AccountStatus | null;
  isLoading: boolean;
  login: () => void;
}

/** Das Konto der Claude-Kommandozeile: beim Einhängen gelesen, bei jedem `account://changed`
 *  (Anfang und Ende einer Anmeldung) neu gelesen. */
export function useAccount(): AccountView {
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const requestRef = useRef<number>(0);

  useEffect(() => {
    const controller = new AbortController();
    let unlisten: UnlistenFn | null = null;

    // Nur die jüngste Antwort zählt: das Lesen dauert bis zu 15 s, Ereignisse überlappen es.
    function load(): void {
      requestRef.current += 1;
      const request: number = requestRef.current;
      setIsLoading(true);
      loadAccount()
        .then((loaded: AccountStatus) => {
          if (!controller.signal.aborted && requestRef.current === request) {
            setStatus(loaded);
            setIsLoading(false);
          }
        })
        .catch((reason: unknown) => {
          console.error('Konto nicht ladbar', reason);
          if (!controller.signal.aborted && requestRef.current === request) {
            setIsLoading(false);
          }
        });
    }

    // Erst abonnieren, dann laden: das Ende der Anmeldung käme sonst womöglich vor dem Abo.
    onAccountChanged(load)
      .then((stop: UnlistenFn) => {
        if (controller.signal.aborted) {
          stop();
          return;
        }
        unlisten = stop;
        load();
      })
      .catch((reason: unknown) => {
        console.error('Konto-Ereignisse nicht abonnierbar', reason);
      });

    return (): void => {
      controller.abort();
      if (unlisten !== null) {
        unlisten();
      }
    };
  }, []);

  function login(): void {
    startAccountLogin().catch((reason: unknown) => {
      console.error('Anmeldung nicht gestartet', reason);
    });
  }

  return { status, isLoading, login };
}
