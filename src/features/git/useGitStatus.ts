import { useCallback, useEffect, useRef, useState } from 'react';
import type { GitSessionStatus } from '@/lib/bindings/GitSessionStatus';
import type { SessionSummary } from '@/lib/bindings/SessionSummary';
import { commandErrorText } from '@/lib/errors';
import { gitFetch, loadGitStatus } from '@/lib/git';

const POLL_INTERVAL_MS = 5000;

/** Einträge, die in diesem App-Lauf schon einmal abgefragt wurden (`sessionId:key`): der Fetch beim ersten
 *  Öffnen der Changes läuft je Eintrag nur einmal. */
const FETCHED_ENTRIES = new Set<string>();

export interface GitStatusState {
  status: GitSessionStatus | null;
  error: string | null;
  /** Liest den Zustand sofort neu, ohne auf den Takt zu warten. */
  reload: () => void;
}

interface LoadedState {
  sessionId: string;
  status: GitSessionStatus | null;
  error: string | null;
}

/** Liest den Git-Zustand der Session: beim Wählen, bei Statuswechsel, beim Fenster-Fokus und — solange die Changes
 *  offen sind — alle 5 s (ein Eingriff von Hand im Ordner meldet sich nicht von allein). Beim ersten Öffnen der
 *  Changes fragt je Eintrag einmal ein Fetch den Remote ab, damit ↓/↑ nicht beliebig alt sind. */
export function useGitStatus(session: SessionSummary | null, isVisible: boolean): GitStatusState {
  const [state, setState] = useState<LoadedState | null>(null);
  const requestRef = useRef<number>(0);
  const inFlightRef = useRef<string | null>(null);

  // Ohne Repository gibt es nichts zu lesen.
  const sessionId: string | null =
    session !== null && session.repositoryCount > 0 ? session.id : null;
  const repositoryCount: number = session === null ? 0 : session.repositoryCount;
  const sessionStatus: string | null = session === null ? null : session.status;

  const load = useCallback((): void => {
    if (sessionId === null || inFlightRef.current === sessionId) {
      return;
    }
    requestRef.current += 1;
    const request: number = requestRef.current;
    inFlightRef.current = sessionId;
    loadGitStatus(sessionId)
      .then((status: GitSessionStatus) => {
        if (requestRef.current === request) {
          setState({ sessionId, status, error: null });
        }
      })
      .catch((reason: unknown) => {
        if (requestRef.current !== request) {
          return;
        }
        // Der letzte gute Zustand derselben Session bleibt stehen, der Fehler kommt dazu.
        setState((current: LoadedState | null) => ({
          sessionId,
          status: current?.sessionId === sessionId ? current.status : null,
          error: commandErrorText(reason),
        }));
      })
      .finally(() => {
        if (inFlightRef.current === sessionId) {
          inFlightRef.current = null;
        }
      });
  }, [sessionId]);

  const reload = useCallback((): void => {
    inFlightRef.current = null;
    load();
  }, [load]);

  // Vor allen Ladevorgängen der neuen Session: eine noch laufende Antwort der alten verfällt.
  useEffect(() => {
    requestRef.current += 1;
    inFlightRef.current = null;
  }, [sessionId]);

  useEffect(() => {
    load();
  }, [load, sessionStatus, isVisible, repositoryCount]);

  useEffect(() => {
    window.addEventListener('focus', load);
    return (): void => {
      window.removeEventListener('focus', load);
    };
  }, [load]);

  useEffect(() => {
    if (!isVisible) {
      return undefined;
    }
    const timer: number = window.setInterval(load, POLL_INTERVAL_MS);
    return (): void => {
      window.clearInterval(timer);
    };
  }, [isVisible, load]);

  const loadedStatus: GitSessionStatus | null =
    state !== null && state.sessionId === sessionId ? state.status : null;

  useEffect(() => {
    if (!isVisible || sessionId === null || loadedStatus === null) {
      return;
    }
    const fresh: string[] = loadedStatus.entries
      .filter((entry) => entry.error === null && !FETCHED_ENTRIES.has(`${sessionId}:${entry.key}`))
      .map((entry) => entry.key);
    if (fresh.length === 0) {
      return;
    }
    for (const key of fresh) {
      FETCHED_ENTRIES.add(`${sessionId}:${key}`);
    }
    // Ein Fetch-Fehler (offline, keine Anmeldung) ist hier kein Befund: ↓/↑ bleiben, wie sie sind.
    Promise.allSettled(fresh.map((key: string) => gitFetch(sessionId, key))).then(reload, reload);
  }, [isVisible, sessionId, loadedStatus, reload]);

  if (state === null || state.sessionId !== sessionId) {
    return { status: null, error: null, reload };
  }
  return { status: state.status, error: state.error, reload };
}
