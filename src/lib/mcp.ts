import { invoke } from '@tauri-apps/api/core';
import { listen, type Event, type UnlistenFn } from '@tauri-apps/api/event';
import type { McpChangedEvent } from '@/lib/bindings/McpChangedEvent';
import type { McpConfigView } from '@/lib/bindings/McpConfigView';
import type { McpDraft } from '@/lib/bindings/McpDraft';
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

/** Schaltet einen Server ein oder aus. Mit zuhörendem Agenten geht eine Steueranfrage hinaus, ohne
 *  Agent schreibt der Core die Datei (`disabledMcpServers` des Workspace); beide Wege liefern `true`.
 *  `everywhere`: beim Ausschalten in allen Vorhaben des Verwalters aus (bleibt gespeichert, gilt auch
 *  für neue Vorhaben). Einschalten nimmt den Namen wieder aus der Liste und schaltet ihn überall ein;
 *  `enabled: false, everywhere: false` für einen Namen aus der Liste: nur hier aus, überall sonst an.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound`, `internal` bei einem Servernamen, den der zuhörende Agent nicht kennt, `invalid` oder `io` bei nicht schreibbaren Dateien */
export function toggleMcpServer(
  sessionId: string,
  server: string,
  enabled: boolean,
  everywhere: boolean,
): Promise<boolean> {
  return invoke<boolean>('mcp_toggle', { sessionId, server, enabled, everywhere });
}

/** Die Server aus den Konfigurationsdateien der Session, auch ohne laufenden Agenten; Zugangsdaten sind verborgen.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound`, `io` ohne Benutzerordner */
export function loadMcpConfig(sessionId: string): Promise<McpConfigView> {
  return invoke<McpConfigView>('mcp_config_load', { sessionId });
}

/** Legt einen Server an (`originalName` leer) oder ersetzt einen (auch zum Umbenennen) und ändert nur
 *  die Datei der Quelle `sourceId`. Ein Paar ohne `value` behält den bisherigen Wert. Ein laufender
 *  Agent übernimmt die Änderung mit seinem nächsten Start; alle Sessions bekommen `mcp://changed`.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `invalid` mit einem Satz bei abgelehnter Eingabe oder unbrauchbarer Datei, `sessionNotFound`, `io` */
export async function saveMcpServer(sessionId: string, draft: McpDraft): Promise<void> {
  await invoke('mcp_config_save', { sessionId, draft });
}

/** Entfernt den Server `name` aus der Quelle `sourceId`; fehlt er dort, ist das kein Fehler.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `invalid` bei unbrauchbarer Datei oder fremder Quelle, `sessionNotFound`, `io` */
export async function removeMcpServer(
  sessionId: string,
  sourceId: string,
  name: string,
): Promise<void> {
  await invoke('mcp_config_remove', { sessionId, sourceId, name });
}

/** Meldet jede Änderung am MCP-Stand einer Session; danach `loadMcp` neu laden. */
export function onMcpChanged(callback: (event: McpChangedEvent) => void): Promise<UnlistenFn> {
  return listen<McpChangedEvent>(MCP_CHANGED_EVENT, (event: Event<McpChangedEvent>) => {
    callback(event.payload);
  });
}
