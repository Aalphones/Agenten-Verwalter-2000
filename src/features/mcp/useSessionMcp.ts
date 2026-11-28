import { useCallback, useEffect, useRef, useState } from 'react';
import type { UnlistenFn } from '@tauri-apps/api/event';
import type { McpChangedEvent } from '@/lib/bindings/McpChangedEvent';
import type { McpConfigView } from '@/lib/bindings/McpConfigView';
import type { McpServer } from '@/lib/bindings/McpServer';
import type { SessionMcp } from '@/lib/bindings/SessionMcp';
import { commandErrorText } from '@/lib/errors';
import { loadMcp, loadMcpConfig, onMcpChanged, refreshMcp } from '@/lib/mcp';

const MCP_POLL_MS = 2000;

interface Loaded<Value> {
  sessionId: string;
  value: Value;
}

export interface SessionMcpState {
  /** Der Stand des Agenten; `null`, solange er nicht geladen ist. */
  mcp: SessionMcp | null;
  /** Die Server aus den Konfigurationsdateien; `null`, solange sie nicht geladen sind. */
  config: McpConfigView | null;
  /** Warum die Konfiguration nicht ladbar ist. */
  configFailure: string | null;
  /** Lädt die Konfigurationsdateien neu; erfüllt sich, wenn die Antwort angewendet ist. */
  reloadConfig: () => Promise<void>;
}

/** Der MCP-Stand der Session, solange ihr Dialog offen ist: beim Öffnen wird der Agent um eine frische
 *  Liste gebeten, danach lädt jedes `mcp://changed` dieser Session Stand und Konfiguration nach. Solange
 *  ein Server noch verbindet, eine Aktion läuft oder eine Anmeldung offen ist, fragt der Hook alle 2 s
 *  nach — die Kommandozeile meldet den Wechsel nicht von selbst. */
export function useSessionMcp(sessionId: string, isOpen: boolean): SessionMcpState {
  const [loaded, setLoaded] = useState<Loaded<SessionMcp> | null>(null);
  const [loadedConfig, setLoadedConfig] = useState<Loaded<McpConfigView> | null>(null);
  const [failure, setFailure] = useState<Loaded<string> | null>(null);
  const requestRef = useRef<number>(0);
  const configRequestRef = useRef<number>(0);

  // Nur die jüngste Antwort zählt: Ereignisse und Öffnen lassen Ladevorgänge überlappen.
  const reloadConfig = useCallback((): Promise<void> => {
    configRequestRef.current += 1;
    const request: number = configRequestRef.current;
    return loadMcpConfig(sessionId)
      .then((config: McpConfigView) => {
        if (configRequestRef.current === request) {
          setLoadedConfig({ sessionId, value: config });
          setFailure(null);
        }
      })
      .catch((reason: unknown) => {
        if (configRequestRef.current === request) {
          setFailure({ sessionId, value: commandErrorText(reason) });
        }
      });
  }, [sessionId]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const controller = new AbortController();
    let unlisten: UnlistenFn | null = null;

    function load(): void {
      requestRef.current += 1;
      const request: number = requestRef.current;
      loadMcp(sessionId)
        .then((mcp: SessionMcp) => {
          if (!controller.signal.aborted && requestRef.current === request) {
            setLoaded({ sessionId, value: mcp });
          }
        })
        .catch((reason: unknown) => {
          console.error('MCP-Stand nicht ladbar', reason);
        });
      void reloadConfig();
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
  }, [sessionId, isOpen, reloadConfig]);

  const current: SessionMcp | null =
    loaded !== null && loaded.sessionId === sessionId ? loaded.value : null;
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

  return {
    mcp: current,
    config:
      loadedConfig !== null && loadedConfig.sessionId === sessionId ? loadedConfig.value : null,
    configFailure: failure !== null && failure.sessionId === sessionId ? failure.value : null,
    reloadConfig,
  };
}
