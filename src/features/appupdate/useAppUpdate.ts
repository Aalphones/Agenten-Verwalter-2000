import { useCallback, useEffect, useRef, useState } from 'react';
import type { UnlistenFn } from '@tauri-apps/api/event';
import { installAppUpdate, loadAppUpdate, onAppUpdateProgress } from '@/lib/appUpdate';
import type { AppUpdateProgress } from '@/lib/bindings/AppUpdateProgress';
import type { AppUpdateStatus } from '@/lib/bindings/AppUpdateStatus';
import { commandErrorText } from '@/lib/errors';
import { useAppUpdateStore } from '@/stores/appUpdate';

interface AppUpdateCheck {
  /** `null`, bis die erste Abfrage zurück ist. */
  status: AppUpdateStatus | null;
  isChecking: boolean;
  /** Fragt die Releases erneut ab. */
  check: () => void;
}

interface AppUpdateInstall {
  /** `null` vor dem ersten Ereignis der Installation. */
  progress: AppUpdateProgress | null;
  isInstalling: boolean;
  /** Satz, wenn die Installation scheiterte; bei Erfolg endet die App. */
  error: string | null;
  install: () => void;
}

/** Status des Updates des Verwalters: fragt beim Einhängen einmal ab und danach nur auf `check`
 *  (kein Zeitgeber). Das Ergebnis liegt im Store, damit die Sidebar es ebenfalls sieht. */
export function useAppUpdateCheck(): AppUpdateCheck {
  const status: AppUpdateStatus | null = useAppUpdateStore((state) => state.status);
  const setStatus = useAppUpdateStore((state) => state.setStatus);
  const [isChecking, setIsChecking] = useState<boolean>(true);
  const requestRef = useRef<number>(0);
  const isAliveRef = useRef<boolean>(true);

  // Nur die jüngste Antwort zählt: die Abfrage dauert bis zu 10 s, ein „Erneut prüfen“ überholt sie.
  const fetchStatus = useCallback((): void => {
    requestRef.current += 1;
    const request: number = requestRef.current;
    loadAppUpdate()
      .then((loaded: AppUpdateStatus) => {
        if (isAliveRef.current && requestRef.current === request) {
          setStatus(loaded);
          setIsChecking(false);
        }
      })
      .catch((reason: unknown) => {
        console.error('Update des Verwalters nicht abfragbar', reason);
        if (isAliveRef.current && requestRef.current === request) {
          setIsChecking(false);
        }
      });
  }, [setStatus]);

  // `isChecking` startet wahr; die Abfrage beim Einhängen muss es nicht erneut setzen.
  useEffect(() => {
    isAliveRef.current = true;
    fetchStatus();
    return (): void => {
      isAliveRef.current = false;
    };
  }, [fetchStatus]);

  const check = useCallback((): void => {
    setIsChecking(true);
    fetchStatus();
  }, [fetchStatus]);

  return { status, isChecking, check };
}

/** Installation des neuesten Releases samt Fortschritt aus `app-update://progress`. */
export function useAppUpdateInstall(): AppUpdateInstall {
  const [progress, setProgress] = useState<AppUpdateProgress | null>(null);
  const [isInstalling, setIsInstalling] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let unlisten: UnlistenFn | null = null;

    onAppUpdateProgress(setProgress)
      .then((stop: UnlistenFn) => {
        if (controller.signal.aborted) {
          stop();
          return;
        }
        unlisten = stop;
      })
      .catch((reason: unknown) => {
        console.error('Fortschritt des Updates nicht abonnierbar', reason);
      });

    return (): void => {
      controller.abort();
      if (unlisten !== null) {
        unlisten();
      }
    };
  }, []);

  function install(): void {
    setIsInstalling(true);
    setError(null);
    setProgress(null);
    installAppUpdate().catch((reason: unknown) => {
      console.error('Update des Verwalters nicht installiert', reason);
      setError(commandErrorText(reason));
      setIsInstalling(false);
    });
  }

  return { progress, isInstalling, error, install };
}
