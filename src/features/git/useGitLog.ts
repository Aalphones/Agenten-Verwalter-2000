import { useEffect, useRef, useState } from 'react';
import type { GitLog } from '@/lib/bindings/GitLog';
import { commandErrorText } from '@/lib/errors';
import { loadGitLog } from '@/lib/git';

export interface GitLogState {
  log: GitLog | null;
  error: string | null;
}

interface LoadedLog extends GitLogState {
  sessionId: string;
  key: string;
}

/** Liest den Verlauf des Eintrags `key` neu, sobald sich `refreshSignal` ändert — der Aufrufer leitet es aus dem
 *  Git-Zustand ab (Branch, ↓/↑, eigene Commits, letzter Fetch), so folgt der Verlauf jeder Git-Aktion ohne eigenen
 *  Takt. Der letzte gute Verlauf bleibt bei einem Fehler stehen. */
export function useGitLog(sessionId: string, key: string, refreshSignal: string): GitLogState {
  const [state, setState] = useState<LoadedLog | null>(null);
  const requestRef = useRef<number>(0);

  useEffect(() => {
    requestRef.current += 1;
    const request: number = requestRef.current;
    loadGitLog(sessionId, key)
      .then((log: GitLog) => {
        if (requestRef.current === request) {
          setState({ sessionId, key, log, error: null });
        }
      })
      .catch((reason: unknown) => {
        if (requestRef.current !== request) {
          return;
        }
        setState((current: LoadedLog | null) => ({
          sessionId,
          key,
          log: current?.sessionId === sessionId && current.key === key ? current.log : null,
          error: commandErrorText(reason),
        }));
      });
    return (): void => {
      requestRef.current += 1;
    };
  }, [sessionId, key, refreshSignal]);

  if (state === null || state.sessionId !== sessionId || state.key !== key) {
    return { log: null, error: null };
  }
  return { log: state.log, error: state.error };
}
