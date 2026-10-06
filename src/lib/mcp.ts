import { invoke } from '@tauri-apps/api/core';
import { listen, type Event, type UnlistenFn } from '@tauri-apps/api/event';
import type { McpChangedEvent } from '@/lib/bindings/McpChangedEvent';
import type { SessionMcp } from '@/lib/bindings/SessionMcp';

const MCP_CHANGED_EVENT = 'mcp://changed';

/** Der letzte Stand der MCP-Server der Session und ob ihr Agent läuft.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound` */
export function loadMcp(sessionId: string): Promise<SessionMcp> {
  return invoke<SessionMcp>('mcp_load', { sessionId });
}

/** Fragt den Agenten nach der aktuellen Serverliste; die Antwort kommt als `mcp://changed`.
 *  `false`, wenn der Agent nicht zuhört.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound` */
export function refreshMcp(sessionId: string): Promise<boolean> {
  return invoke<boolean>('mcp_refresh', { sessionId });
}

/** Baut die Verbindung zu einem Server neu auf; Beginn und Ende melden `mcp://changed`.
 *  `false`, wenn der Agent nicht zuhört.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound`, `internal` bei einem Servernamen, der nicht in der Liste steht */
export function reconnectMcpServer(sessionId: string, server: string): Promise<boolean> {
  return invoke<boolean>('mcp_reconnect', { sessionId, server });
}

/** Startet die Anmeldung bei einem Server; der Core öffnet die Anmeldeseite im Browser, Beginn und Ende melden `mcp://changed`.
 *  `false`, wenn der Agent nicht zuhört.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound`, `internal` bei einem Servernamen, der nicht in der Liste steht */
export function authenticateMcpServer(sessionId: string, server: string): Promise<boolean> {
  return invoke<boolean>('mcp_authenticate', { sessionId, server });
}

/** Schaltet einen Server ein oder aus; die Kommandozeile merkt sich das je Arbeitsordner.
 *  `false`, wenn der Agent nicht zuhört.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound`, `internal` bei einem Servernamen, der nicht in der Liste steht */
export function toggleMcpServer(
  sessionId: string,
  server: string,
  enabled: boolean,
): Promise<boolean> {
  return invoke<boolean>('mcp_toggle', { sessionId, server, enabled });
}

/** Meldet jede Änderung am MCP-Stand einer Session; danach `loadMcp` neu laden. */
export function onMcpChanged(callback: (event: McpChangedEvent) => void): Promise<UnlistenFn> {
  return listen<McpChangedEvent>(MCP_CHANGED_EVENT, (event: Event<McpChangedEvent>) => {
    callback(event.payload);
  });
}
