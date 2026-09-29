import { useEffect, useRef, useState } from 'react';
import type { ScratchpadListing } from '@/lib/bindings/ScratchpadListing';
import type { SessionStatus } from '@/lib/bindings/SessionStatus';
import type { SessionSummary } from '@/lib/bindings/SessionSummary';
import { listScratchpad } from '@/lib/background';
import { commandErrorText } from '@/lib/errors';

const POLL_INTERVAL_MS = 5000;

const ACTIVE_STATUSES: readonly SessionStatus[] = ['starting', 'running', 'waiting'];

export interface ScratchpadState {
  listing: ScratchpadListing | null;
  error: string | null;
}

interface LoadedState extends ScratchpadState {
  sessionId: string;
}

const NOTHING: ScratchpadState = { listing: null, error: null };

/** Der Scratchpad-Ordner der Session: beim Sichtbarwerden, bei Statuswechsel und — solange der Agent arbeitet —
 *  alle 5 s. Ein Dateisystem-Beobachter kostet Ressourcen, auch wenn niemand hinsieht; deshalb der Takt. Der Aufrufer
 *  rendert den Reiter nur, solange er sichtbar ist. */
export function useScratchpad(session: SessionSummary): ScratchpadState {
  const [state, setState] = useState<LoadedState | null>(null);
  const requestRef = useRef<number>(0);

  const sessionId: string = session.id;
  const status: SessionStatus = session.status;
  const isAgentActive: boolean = ACTIVE_STATUSES.includes(status);

  useEffect(() => {
    const controller = new AbortController();

    // Nur die jüngste Antwort zählt; ein schneller Session-Wechsel zeigt nie Dateien der vorigen.
    function load(): void {
      requestRef.current += 1;
      const request: number = requestRef.current;
      listScratchpad(sessionId)
        .then((listing: ScratchpadListing) => {
          if (!controller.signal.aborted && requestRef.current === request) {
            setState({ sessionId, listing, error: null });
          }
        })
        .catch((reason: unknown) => {
          if (controller.signal.aborted || requestRef.current !== request) {
            return;
          }
          setState((current: LoadedState | null) => ({
            sessionId,
            listing: current?.sessionId === sessionId ? current.listing : null,
            error: commandErrorText(reason),
          }));
        });
    }

    load();
    let timer: number | null = null;
    if (isAgentActive) {
      timer = window.setInterval(load, POLL_INTERVAL_MS);
    }
    return (): void => {
      controller.abort();
      if (timer !== null) {
        window.clearInterval(timer);
      }
    };
  }, [sessionId, status, isAgentActive]);

  if (state === null || state.sessionId !== sessionId) {
    return NOTHING;
  }
  return { listing: state.listing, error: state.error };
}
