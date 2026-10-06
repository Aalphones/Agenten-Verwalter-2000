import type { McpAction } from '@/lib/bindings/McpAction';
import type { McpActionError } from '@/lib/bindings/McpActionError';
import type { McpAuthWait } from '@/lib/bindings/McpAuthWait';
import type { McpServer } from '@/lib/bindings/McpServer';
import type { McpServerStatus } from '@/lib/bindings/McpServerStatus';

/** Reihenfolge der Gruppen im Dialog; unbekannte Herkünfte folgen in der Reihenfolge ihres ersten Auftretens. */
const SCOPE_ORDER: readonly string[] = [
  'user',
  'project',
  'local',
  'claudeai',
  'enterprise',
  'dynamic',
];

const STATUS_TEXTS: Readonly<Record<McpServerStatus, string>> = {
  connected: 'Verbunden',
  pending: 'Verbindet …',
  failed: 'Fehlgeschlagen',
  needsAuth: 'Anmeldung nötig',
  disabled: 'Aus',
  unknown: 'Unbekannt',
};

const GROUP_NAMES: Readonly<Record<string, string>> = {
  user: 'Benutzer',
  project: 'Projekt',
  local: 'Lokal',
  claudeai: 'claude.ai',
  enterprise: 'Organisation',
  dynamic: 'Kommandozeile',
  '': 'Sonstige',
};

const ORIGIN_TEXTS: Readonly<Record<string, string>> = {
  user: 'Benutzer-Konfiguration',
  project: 'Projekt-Konfiguration (.mcp.json)',
  local: 'Lokale Konfiguration',
  claudeai: 'claude.ai-Connector',
  enterprise: 'Organisation',
  dynamic: 'Beim Start übergeben',
  '': 'unbekannt',
};

const ACTION_FAILURE_PREFIXES: Readonly<Record<McpAction, string>> = {
  reconnect: 'Neu verbinden von',
  enable: 'Einschalten von',
  disable: 'Ausschalten von',
  authenticate: 'Anmeldung bei',
};

const DETAIL_NOTES: Readonly<Partial<Record<McpServerStatus, string>>> = {
  disabled: 'Ausgeschaltet – der Agent sieht die Werkzeuge dieses Servers nicht.',
  pending: 'Verbindet …',
  needsAuth: 'Der Server braucht eine Anmeldung. „Anmelden“ öffnet sie im Browser.',
};

export const LOGIN_LABEL = 'Anmelden';
export const LOGIN_TITLE = 'Anmeldeseite dieses Servers im Browser öffnen';
export const REOPEN_LABEL = 'Seite erneut öffnen';
export const RECONNECT_LABEL = 'Neu verbinden';

export const NO_TOOLS_TEXT = 'Keine Werkzeuge gemeldet.';
export const NO_ERROR_REASON_TEXT = 'Die Kommandozeile nennt keinen Grund.';
export const ERROR_BOX_TITLE = 'Verbindung fehlgeschlagen';
export const FOOT_NOTE = 'Ausgeschaltete Server bleiben für alle Sessions dieses Vorhabens aus.';
export const SWITCH_TITLE =
  'Ausschalten: der Agent sieht die Werkzeuge dieses Servers nicht mehr. Gilt für alle Sessions dieses Vorhabens, auch nach einem Neustart.';
export const SWITCH_TITLE_OFF =
  'Einschalten: der Agent bietet die Werkzeuge dieses Servers wieder an.';
export const RECONNECT_TITLE = 'Verbindung zu diesem Server neu aufbauen';
export const LOADING_TEXT = 'MCP-Server werden geladen …';
export const NEW_SESSION_TEXT =
  'Die MCP-Server starten mit dem Agenten. Schick die erste Nachricht, dann erscheinen sie hier.';
export const AGENT_IDLE_TEXT =
  'Der Agent dieser Session ruht gerade, und mit ihm seine MCP-Server. Schick eine Nachricht, dann erscheinen sie hier wieder.';
export const NO_SERVERS_TEXT =
  'Keine MCP-Server eingerichtet. Einrichten geht in der Claude-Kommandozeile mit „claude mcp add“ oder als Connector auf claude.ai.';

export interface McpGroup {
  scope: string;
  title: string;
  servers: McpServer[];
}

/** Die Server nach Herkunft gruppiert; der Filter wirkt auf den Namen, ohne Groß-/Kleinschreibung.
 *  Leere Gruppen fallen weg, innerhalb einer Gruppe bleibt die Reihenfolge der Kommandozeile. */
export function groupServers(servers: readonly McpServer[], filter: string): McpGroup[] {
  const needle: string = filter.trim().toLowerCase();
  const matching: McpServer[] = servers.filter((server: McpServer) =>
    server.name.toLowerCase().includes(needle),
  );

  const scopes: string[] = [...SCOPE_ORDER];
  for (const server of matching) {
    if (!scopes.includes(server.scope)) {
      scopes.push(server.scope);
    }
  }

  const groups: McpGroup[] = [];
  for (const scope of scopes) {
    const members: McpServer[] = matching.filter((server: McpServer) => server.scope === scope);
    if (members.length > 0) {
      groups.push({
        scope,
        title: `${groupName(scope)} (${String(members.length)})`,
        servers: members,
      });
    }
  }
  return groups;
}

export function statusText(status: McpServerStatus): string {
  return STATUS_TEXTS[status];
}

export function groupName(scope: string): string {
  return GROUP_NAMES[scope] ?? scope;
}

export function originText(scope: string): string {
  return ORIGIN_TEXTS[scope] ?? scope;
}

/** Der Satz, der in den Details eines Servers ohne Werkzeugliste steht; `null`, wenn es dort nichts zu sagen gibt. */
export function detailNote(status: McpServerStatus): string | null {
  return DETAIL_NOTES[status] ?? null;
}

export function toolsLabel(count: number): string {
  if (count === 1) {
    return '1 Werkzeug';
  }
  return `${String(count)} Werkzeuge`;
}

export function toolsTitle(count: number): string {
  return `Werkzeuge (${String(count)})`;
}

/** „2 von 5 verbunden“, dahinter nur, was vorkommt: fehlgeschlagen, Anmeldung nötig, aus. */
export function summaryText(servers: readonly McpServer[]): string {
  let text = `${String(countWithStatus(servers, 'connected'))} von ${String(servers.length)} verbunden`;
  const failed: number = countWithStatus(servers, 'failed');
  const needsAuth: number = countWithStatus(servers, 'needsAuth');
  const disabled: number = countWithStatus(servers, 'disabled');
  if (failed > 0) {
    text += ` · ${String(failed)} fehlgeschlagen`;
  }
  if (needsAuth > 0) {
    text += ` · ${String(needsAuth)} Anmeldung nötig`;
  }
  if (disabled > 0) {
    text += ` · ${String(disabled)} aus`;
  }
  return text;
}

export function actionErrorText(error: McpActionError): string {
  return `${ACTION_FAILURE_PREFIXES[error.action]} „${error.server}“ fehlgeschlagen: ${error.text}`;
}

/** Der Hinweis über der Liste, solange eine Anmeldung offen ist. */
export function authWaitText(auth: McpAuthWait): string {
  if (auth.callbackExpected) {
    return `Anmeldung für „${auth.server}“ im Browser geöffnet. Nach der Anmeldung verbindet sich der Server von selbst.`;
  }
  return `Anmeldung für „${auth.server}“ auf claude.ai im Browser geöffnet. Danach hier neu verbinden.`;
}

/** Der Hinweis in der Eingabeleiste. */
export function problemLabel(count: number): string {
  return `MCP · ${problemShort(count)}`;
}

/** Der Hinweis in der Zeile `/mcp` des `/`-Menüs. */
export function problemShort(count: number): string {
  if (count === 1) {
    return '1 Problem';
  }
  return `${String(count)} Probleme`;
}

function countWithStatus(servers: readonly McpServer[], status: McpServerStatus): number {
  return servers.filter((server: McpServer) => server.status === status).length;
}
