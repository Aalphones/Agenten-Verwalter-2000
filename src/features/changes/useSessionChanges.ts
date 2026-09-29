import { useCallback, useEffect, useRef, useState } from 'react';
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
}

interface LoadedState extends SessionChangesState {
  sessionId: string;
}

const NOTHING: SessionChangesState = { changes: null, error: null };

/** Liest die Changes der Session aus dem Core: beim Wählen, bei Statuswechsel, beim Öffnen des Reiters, beim
 *  Fenster-Fokus und — solange der Reiter offen ist und der Agent arbeitet — alle 5 s. Ein Dateisystem-Beobachter
 *  kostet pro Worktree Ressourcen, auch wenn niemand hinsieht; deshalb der Takt. */
export function useSessionChanges(
  session: SessionSummary | null,
  isVisible: boolean,
): SessionChangesState {
  const [state, setState] = useState<LoadedState | null>(null);
  const requestRef = useRef<number>(0);
  const inFlightRef = useRef<string | null>(null);

  // Ohne Repository gibt es nichts zu lesen.
  const sessionId: string | null =
    session !== null && session.repositoryCount > 0 ? session.id : null;
  const status: SessionStatus | null = session === null ? null : session.status;
  const isAgentActive: boolean = status !== null && ACTIVE_STATUSES.includes(status);

  const load = useCallback((): void => {
    if (sessionId === null || inFlightRef.current === sessionId) {
      return;
    }
    requestRef.current += 1;
    const request: number = requestRef.current;
    inFlightRef.current = sessionId;
    loadChanges(sessionId)
      .then((changes: SessionChanges) => {
        if (requestRef.current === request) {
          setState({ sessionId, changes, error: null });
        }
      })
      .catch((reason: unknown) => {
        if (requestRef.current !== request) {
          return;
        }
        // Die letzten guten Changes derselben Session bleiben stehen, der Fehler kommt dazu.
        setState((current: LoadedState | null) => ({
          sessionId,
          changes: current?.sessionId === sessionId ? current.changes : null,
          error: commandErrorText(reason),
        }));
      })
      .finally(() => {
        if (inFlightRef.current === sessionId) {
          inFlightRef.current = null;
        }
      });
  }, [sessionId]);

  // Vor allen Ladevorgängen der neuen Session: eine noch laufende Antwort der alten verfällt.
  useEffect(() => {
    requestRef.current += 1;
    inFlightRef.current = null;
  }, [sessionId]);

  useEffect(() => {
    load();
  }, [load, status, isVisible]);

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

  if (state === null || state.sessionId !== sessionId) {
    return NOTHING;
  }
  return { changes: state.changes, error: state.error };
}
