import { useEffect, useRef, useState } from 'react';
import type { UnlistenFn } from '@tauri-apps/api/event';
import type { McpChangedEvent } from '@/lib/bindings/McpChangedEvent';
import type { McpServer } from '@/lib/bindings/McpServer';
import type { SessionMcp } from '@/lib/bindings/SessionMcp';
import { loadMcp, onMcpChanged, refreshMcp } from '@/lib/mcp';

const MCP_POLL_MS = 2000;

interface LoadedMcp {
  sessionId: string;
  mcp: SessionMcp;
}

/** Der MCP-Stand der Session, solange ihr Dialog offen ist: beim Öffnen wird der Agent um eine frische
 *  Liste gebeten, danach lädt jedes `mcp://changed` dieser Session nach. Solange ein Server noch verbindet,
 *  eine Aktion läuft oder eine Anmeldung offen ist, fragt der Hook alle 2 s nach — die Kommandozeile meldet den Wechsel nicht von selbst. */
export function useSessionMcp(sessionId: string, isOpen: boolean): SessionMcp | null {
  const [loaded, setLoaded] = useState<LoadedMcp | null>(null);
  const requestRef = useRef<number>(0);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const controller = new AbortController();
    let unlisten: UnlistenFn | null = null;

    // Nur die jüngste Antwort zählt: Ereignisse und Öffnen lassen Ladevorgänge überlappen.
    function load(): void {
      requestRef.current += 1;
      const request: number = requestRef.current;
      loadMcp(sessionId)
        .then((mcp: SessionMcp) => {
          if (!controller.signal.aborted && requestRef.current === request) {
            setLoaded({ sessionId, mcp });
          }
        })
        .catch((reason: unknown) => {
          console.error('MCP-Stand nicht ladbar', reason);
        });
    }

    // Erst abonnieren, dann anfragen: die Antwort des Agenten käme sonst vor dem Abo.
    onMcpChanged((event: McpChangedEvent) => {
      if (event.sessionId === sessionId) {
        load();
      }
    })
      .then((stop: UnlistenFn) => {
        if (controller.signal.aborted) {
          stop();
          return;
        }
        unlisten = stop;
        refreshMcp(sessionId).catch((reason: unknown) => {
          console.error('MCP-Stand nicht anfragbar', reason);
        });
        load();
      })
      .catch((reason: unknown) => {
        console.error('MCP-Ereignisse nicht abonnierbar', reason);
      });

    return (): void => {
      controller.abort();
      if (unlisten !== null) {
        unlisten();
      }
    };
  }, [sessionId, isOpen]);

  const current: SessionMcp | null =
    loaded !== null && loaded.sessionId === sessionId ? loaded.mcp : null;
  const needsPolling: boolean =
    isOpen &&
    current !== null &&
    current.isAgentRunning &&
    (current.servers === null ||
      current.busy.length > 0 ||
      current.auth !== null ||
      current.servers.some((server: McpServer) => server.status === 'pending'));

  useEffect(() => {
    if (!needsPolling) {
      return undefined;
    }
    const timer: number = window.setInterval(() => {
      refreshMcp(sessionId).catch((reason: unknown) => {
        console.error('MCP-Stand nicht anfragbar', reason);
      });
    }, MCP_POLL_MS);
    return (): void => {
      window.clearInterval(timer);
    };
  }, [sessionId, needsPolling]);

  return current;
}
