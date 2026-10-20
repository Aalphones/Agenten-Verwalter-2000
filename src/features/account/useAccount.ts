import { useEffect, useRef, useState } from 'react';
import type { UnlistenFn } from '@tauri-apps/api/event';
import { loadAccount, onAccountChanged, startAccountLogin } from '@/lib/account';
import type { AccountStatus } from '@/lib/bindings/AccountStatus';

/** Woher ein Konto kommt: lesen, Anmeldung starten, auf Änderungen hören. */
export interface AccountSource {
  load: () => Promise<AccountStatus>;
  startLogin: () => Promise<void>;
  onChanged: (callback: () => void) => Promise<UnlistenFn>;
}

const CLAUDE_SOURCE: AccountSource = {
  load: loadAccount,
  startLogin: startAccountLogin,
  onChanged: onAccountChanged,
};

interface AccountView {
  /** `null`, bis der erste Lesevorgang zurück ist. */
  status: AccountStatus | null;
  isLoading: boolean;
  login: () => void;
}

/** Das Konto der Claude-Kommandozeile. */
export function useAccount(): AccountView {
  return useAccountSource(CLAUDE_SOURCE);
}

/** Ein Konto: beim Einhängen gelesen, bei jedem Änderungsereignis der Quelle (Anfang und Ende
 *  einer Anmeldung) neu gelesen. `source` muss über Renderings stabil sein. */
export function useAccountSource(source: AccountSource): AccountView {
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const requestRef = useRef<number>(0);

  useEffect(() => {
    const controller = new AbortController();
    let unlisten: UnlistenFn | null = null;

    // Nur die jüngste Antwort zählt: das Lesen dauert Sekunden, Ereignisse überlappen es.
    function load(): void {
      requestRef.current += 1;
      const request: number = requestRef.current;
      setIsLoading(true);
      source
        .load()
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
    source
      .onChanged(load)
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
  }, [source]);

  function login(): void {
    source.startLogin().catch((reason: unknown) => {
      console.error('Anmeldung nicht gestartet', reason);
    });
  }

  return { status, isLoading, login };
}
