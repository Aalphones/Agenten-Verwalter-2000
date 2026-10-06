import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangesReach } from '@/lib/bindings/ChangesReach';
import type { SessionChanges } from '@/lib/bindings/SessionChanges';
import type { SessionStatus } from '@/lib/bindings/SessionStatus';
import type { SessionSummary } from '@/lib/bindings/SessionSummary';
import { loadChanges } from '@/lib/changes';
import { commandErrorText } from '@/lib/errors';

const POLL_INTERVAL_MS = 5000;

const ACTIVE_STATUSES: readonly SessionStatus[] = ['starting', 'running', 'waiting'];

export interface SessionChangesState {
  changes: SessionChanges | null;
  error: string | null;
  /** Liest sofort neu, auch wenn gerade eine Abfrage läuft — deren Antwort verfällt, sie kann vor der Änderung
   *  gelesen haben, die den Aufruf auslöst. */
  reload: () => void;
}

interface LoadedState {
  requestKey: string;
  changes: SessionChanges | null;
  error: string | null;
}

/** Liest die Changes der Session aus dem Core: beim Wählen, bei Statuswechsel, beim Öffnen des Reiters, beim
 *  Fenster-Fokus und — solange der Reiter offen ist und der Agent arbeitet — alle 5 s. Ein Dateisystem-Beobachter
 *  kostet pro Worktree Ressourcen, auch wenn niemand hinsieht; deshalb der Takt. `reach`: wessen Änderungen
 *  (ADR 014). */
export function useSessionChanges(
  session: SessionSummary | null,
  reach: ChangesReach,
  isVisible: boolean,
): SessionChangesState {
  const [state, setState] = useState<LoadedState | null>(null);
  const requestRef = useRef<number>(0);
  const inFlightRef = useRef<string | null>(null);

  // Ohne Repository gibt es nichts zu lesen.
  const sessionId: string | null =
    session !== null && session.repositoryCount > 0 ? session.id : null;
  // Ein angehängtes Repository ändert die Changes, ohne dass sich Session oder Status ändern.
  const repositoryCount: number = session === null ? 0 : session.repositoryCount;
  // Reichweite und Session zusammen: ein Wechsel Übersicht ↔ Session derselben Nummer verwirft die alte Antwort.
  const requestKey: string | null = sessionId === null ? null : `${reach}:${sessionId}`;
  const status: SessionStatus | null = session === null ? null : session.status;
  const isAgentActive: boolean = status !== null && ACTIVE_STATUSES.includes(status);

  const load = useCallback((): void => {
    if (sessionId === null || requestKey === null || inFlightRef.current === requestKey) {
      return;
    }
    requestRef.current += 1;
    const request: number = requestRef.current;
    inFlightRef.current = requestKey;
    loadChanges(sessionId, reach)
      .then((changes: SessionChanges) => {
        if (requestRef.current === request) {
          setState({ requestKey, changes, error: null });
        }
      })
      .catch((reason: unknown) => {
        if (requestRef.current !== request) {
          return;
        }
        // Die letzten guten Changes derselben Session und Reichweite bleiben stehen, der Fehler kommt dazu.
        setState((current: LoadedState | null) => ({
          requestKey,
          changes: current?.requestKey === requestKey ? current.changes : null,
          error: commandErrorText(reason),
        }));
      })
      .finally(() => {
        if (inFlightRef.current === requestKey) {
          inFlightRef.current = null;
        }
      });
  }, [sessionId, reach, requestKey]);

  const reload = useCallback((): void => {
    inFlightRef.current = null;
    load();
  }, [load]);

  // Vor allen Ladevorgängen der neuen Session oder Reichweite: eine noch laufende Antwort der alten verfällt.
  useEffect(() => {
    requestRef.current += 1;
    inFlightRef.current = null;
  }, [requestKey]);

  useEffect(() => {
    load();
  }, [load, status, isVisible, repositoryCount]);

  useEffect(() => {
    window.addEventListener('focus', load);
    return (): void => {
      window.removeEventListener('focus', load);
    };
  }, [load]);

  useEffect(() => {
    if (!isVisible || !isAgentActive) {
      return undefined;
    }
    const timer: number = window.setInterval(load, POLL_INTERVAL_MS);
    return (): void => {
      window.clearInterval(timer);
    };
  }, [isVisible, isAgentActive, load]);

  if (state === null || state.requestKey !== requestKey) {
    return { changes: null, error: null, reload };
  }
  return { changes: state.changes, error: state.error, reload };
}
