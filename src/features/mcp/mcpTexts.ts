import type { McpAction } from '@/lib/bindings/McpAction';
import type { McpActionError } from '@/lib/bindings/McpActionError';
import type { McpAuthWait } from '@/lib/bindings/McpAuthWait';
import type { McpConfigEntry } from '@/lib/bindings/McpConfigEntry';
import type { McpConfigView } from '@/lib/bindings/McpConfigView';
import type { McpServer } from '@/lib/bindings/McpServer';
import type { McpServerStatus } from '@/lib/bindings/McpServerStatus';
import type { McpSource } from '@/lib/bindings/McpSource';
import type { McpSourceKind } from '@/lib/bindings/McpSourceKind';
import type { McpTransport } from '@/lib/bindings/McpTransport';

export type McpGroupKind = McpSourceKind | 'fixed';

/** Reichweite und Datei im Gruppenkopf; `file` steht in Mono, `suffix` wieder in der Textschrift. */
export interface McpGroupWhere {
  reach: string;
  file: string;
  suffix: string;
}

/** Ein Server der Liste. Aus den Dateien (`entry`, dazu `live`, wenn der Agent ihn meldet) oder
 *  fest eingebunden (nur `live`). */
export interface McpRow {
  key: string;
  name: string;
  sourceId: string | null;
  entry: McpConfigEntry | null;
  live: McpServer | null;
  /** Gruppentitel der Quelle, deren gleichnamiger Server gewinnt. */
  shadowedByTitle: string | null;
}

export interface McpRowGroup {
  id: string;
  title: string;
  /** `null` bei „Fest eingebunden“. */
  where: McpGroupWhere | null;
  kind: McpGroupKind;
  /** Die Datei der Quelle ist nicht lesbar: ein Satz ohne Dateiinhalt. */
  error: string | null;
  rows: McpRow[];
}

/** Stellung des dreistufigen Schalters: überall aus, aus in diesem Vorhaben, an. */
export type McpSwitchPosition = 'all' | 'here' | 'on';

export type McpRowStatus =
  McpServerStatus | 'off' | 'offAll' | 'idle' | 'fresh' | 'shadowed' | 'loading';

const FIXED_GROUP_ID = 'fixed';

const GROUP_ORDER: readonly McpSourceKind[] = ['user', 'repository', 'workspace', 'local'];

/** Herkünfte, unter denen die Kommandozeile Server aus den verwalteten Dateien meldet. */
const FILE_SCOPES: readonly string[] = ['user', 'project', 'local'];

const FIXED_ORIGINS: Readonly<Record<string, string>> = {
  claudeai: 'claude.ai-Connector',
  enterprise: 'Organisation',
};
const FIXED_ORIGIN_DEFAULT = 'vom Verwalter';

const ROW_STATUS_TEXTS: Readonly<Record<McpRowStatus, string>> = {
  connected: 'Verbunden',
  pending: 'Verbindet …',
  failed: 'Fehlgeschlagen',
  needsAuth: 'Anmeldung nötig',
  disabled: 'Aus',
  unknown: 'Unbekannt',
  off: 'Aus hier',
  offAll: 'Aus überall',
  idle: 'Startet mit Agent',
  fresh: 'Ab nächster Nachricht',
  shadowed: 'Überdeckt',
  loading: 'Lädt …',
};

const TRANSPORT_TEXTS: Readonly<Record<McpTransport, string>> = {
  stdio: 'stdio',
  http: 'HTTP',
  sse: 'SSE',
  other: 'Andere',
};

const ACTION_FAILURE_PREFIXES: Readonly<Record<McpAction, string>> = {
  reconnect: 'Neu verbinden von',
  enable: 'Einschalten von',
  disable: 'Ausschalten von',
  authenticate: 'Anmeldung bei',
};

export const LOGIN_LABEL = 'Anmelden';
export const LOGIN_TITLE = 'Anmeldeseite dieses Servers im Browser öffnen';
export const REOPEN_LABEL = 'Seite erneut öffnen';
export const RECONNECT_LABEL = 'Neu verbinden';
export const RECONNECT_TITLE_DISABLED = 'Neu verbinden geht nur bei laufendem Agenten';
export const EDIT_LABEL = 'Bearbeiten';
export const REMOVE_LABEL = 'Entfernen';
export const FIXED_LABEL = 'fest';

export const AGENT_RUNNING_TEXT = 'Agent läuft · Stand live';
export const AGENT_RESTING_TEXT = 'Agent ruht · Stand aus den Konfigurationsdateien';
export const AGENT_NEW_TEXT = 'Noch nicht gestartet · Stand aus den Konfigurationsdateien';

export const OFFLINE_HINT =
  'Verbindungszustand erscheint, sobald der Agent läuft. Schalten, Bearbeiten und Werkzeuge ansehen geht schon jetzt.';
export const CONFIG_CHANGED_HINT =
  'Änderungen wirken ab der nächsten Nachricht – der Agent startet dann neu.';

export const ADD_SHORT_LABEL = 'Server';
export const ADD_LONG_SUFFIX = 'hinzufügen';
export const LOCAL_EMPTY_TEXT = 'Server, die nur du in diesem Vorhaben brauchst.';
export const LOCAL_ADD_LABEL = 'Hier hinzufügen';

export const UNDO_LABEL = 'Rückgängig';
export const UNDO_REPOSITORY_SUFFIX = ' – betrifft alle im Repo';

export const NO_TOOLS_TEXT = 'Keine Werkzeuge gemeldet.';
export const NO_ERROR_REASON_TEXT = 'Die Kommandozeile nennt keinen Grund.';
export const ERROR_BOX_TITLE = 'Verbindung fehlgeschlagen';
export const AUTH_BOX_TITLE = 'Anmeldung nötig';
export const AUTH_BOX_TEXT =
  '„Anmelden“ öffnet die Anmeldeseite im Browser; danach verbindet sich der Server von selbst.';
export const OFF_NOTE = 'Ausgeschaltet – der Agent sieht die Werkzeuge dieses Servers nicht.';
export const SECRET_MASK = '••••••••';
export const SECRET_NOTE = 'gesetzt · ändern unter Bearbeiten';

export const FOOT_NOTE = 'Schalter: links überall aus · Mitte hier aus · rechts an.';
export const LOADING_TEXT = 'MCP-Server werden geladen …';
export const NO_SERVERS_TITLE = 'Noch keine MCP-Server';
export const NO_SERVERS_TEXT =
  'Ein MCP-Server gibt dem Agenten zusätzliche Werkzeuge, z. B. Zugriff auf ein Ticketsystem.';

export const SWITCH_LABELS: Readonly<Record<McpSwitchPosition, string>> = {
  all: 'Überall aus – auch in neuen Vorhaben',
  here: 'Aus in diesem Vorhaben',
  on: 'An',
};

/** Die Server der Konfigurationsdateien nach Ablageort, dahinter „Fest eingebunden“ für alles,
 *  was nur der laufende Agent kennt. `live` ist `null` ohne Agenten oder vor dessen erster Liste.
 *  `removedNames`: hier entfernte Server, die der Agent bis zu seinem Neustart weiter meldet. */
export function mergeServers(
  config: McpConfigView,
  live: readonly McpServer[] | null,
  removedNames: ReadonlySet<string>,
): McpRowGroup[] {
  const liveServers: readonly McpServer[] = live ?? [];
  const matched = new Set<string>();
  const sources: McpSource[] = [...config.sources].sort(
    (first: McpSource, second: McpSource) =>
      GROUP_ORDER.indexOf(first.kind) - GROUP_ORDER.indexOf(second.kind),
  );

  const groups: McpRowGroup[] = sources.map((source: McpSource) => ({
    id: source.id,
    title: sourceTitle(source),
    where: sourceWhere(source),
    kind: source.kind,
    error: source.error,
    rows: source.servers.map((entry: McpConfigEntry) => {
      let server: McpServer | null = null;
      // Der Agent kennt je Name nur den Server, der gewinnt.
      if (entry.shadowedBy === null) {
        server = liveServers.find((known: McpServer) => known.name === entry.name) ?? null;
      }
      if (server !== null) {
        matched.add(server.name);
      }
      return {
        key: `${source.id}/${entry.name}`,
        name: entry.name,
        sourceId: source.id,
        entry,
        live: server,
        shadowedByTitle: shadowedByTitle(config, entry.shadowedBy),
      };
    }),
  }));

  const fixedRows: McpRow[] = liveServers
    .filter((server: McpServer) => !matched.has(server.name))
    // Aus den Dateien verschwunden, aber bis zum Neustart noch geladen: nicht fest eingebunden.
    .filter(
      (server: McpServer) =>
        !config.configChanged ||
        (!FILE_SCOPES.includes(server.scope) && !removedNames.has(server.name)),
    )
    .map((server: McpServer) => ({
      key: `${FIXED_GROUP_ID}/${server.name}`,
      name: server.name,
      sourceId: null,
      entry: null,
      live: server,
      shadowedByTitle: null,
    }));
  groups.push({
    id: FIXED_GROUP_ID,
    title: 'Fest eingebunden',
    where: null,
    kind: 'fixed',
    error: null,
    rows: fixedRows,
  });

  // „Nur ich“ bleibt auch leer stehen: dort steht der Weg zum ersten eigenen Server.
  return groups.filter(
    (group: McpRowGroup) => group.rows.length > 0 || group.error !== null || group.kind === 'local',
  );
}

/** Filter auf die Namen, ohne Groß-/Kleinschreibung; beim Filtern fallen leere Gruppen weg.
 *  `hiddenKeys` sind Zeilen, deren Entfernen gerade geschrieben wird; `keptKey` (die
 *  Rückgängig-Zeile) bleibt trotz Filter stehen. */
export function filterGroups(
  groups: readonly McpRowGroup[],
  filter: string,
  hiddenKeys: ReadonlySet<string>,
  keptKey: string | null,
): McpRowGroup[] {
  const needle: string = filter.trim().toLowerCase();
  return groups
    .map((group: McpRowGroup) => ({
      ...group,
      rows: group.rows.filter(
        (row: McpRow) =>
          !hiddenKeys.has(row.key) &&
          (row.key === keptKey || row.name.toLowerCase().includes(needle)),
      ),
    }))
    .filter(
      (group: McpRowGroup) =>
        group.rows.length > 0 ||
        (needle === '' && (group.error !== null || group.kind === 'local')),
    );
}

export function switchPosition(
  row: McpRow,
  disabledEverywhere: readonly string[],
): McpSwitchPosition {
  if (disabledEverywhere.includes(row.name)) {
    return 'all';
  }
  let isOff: boolean = row.entry !== null && !row.entry.enabled;
  if (row.live !== null) {
    isOff = row.live.status === 'disabled';
  }
  if (isOff) {
    return 'here';
  }
  return 'on';
}

export function rowStatus(
  row: McpRow,
  position: McpSwitchPosition,
  isAgentRunning: boolean,
  isLiveLoaded: boolean,
): McpRowStatus {
  if (position === 'all') {
    return 'offAll';
  }
  if (position === 'here') {
    return 'off';
  }
  if (row.shadowedByTitle !== null) {
    return 'shadowed';
  }
  if (!isAgentRunning) {
    return 'idle';
  }
  if (!isLiveLoaded) {
    return 'loading';
  }
  if (row.live === null) {
    return 'fresh';
  }
  return row.live.status;
}

export function rowStatusText(status: McpRowStatus): string {
  return ROW_STATUS_TEXTS[status];
}

/** Zweite Zeile unter dem Namen: Art · Host oder Befehl (fest: Herkunft) · Werkzeuganzahl · Überdeckung. */
export function rowMeta(row: McpRow, status: McpRowStatus): string {
  const parts: string[] = [];
  if (row.entry !== null) {
    parts.push(transportShort(row.entry), shortTarget(row.entry));
  } else if (row.live !== null) {
    // `connection` ist „Art · Ziel“; bei fest eingebundenen zählt statt des Ziels die Herkunft.
    parts.push(row.live.connection.split(' · ')[0] ?? '', fixedOrigin(row.live.scope));
  }
  if (status === 'connected' && row.live !== null) {
    parts.push(toolsLabel(row.live.tools.length));
  }
  if (row.shadowedByTitle !== null) {
    parts.push(`überdeckt von ${row.shadowedByTitle}`);
  }
  return parts.filter(Boolean).join(' · ');
}

export function fixedOrigin(scope: string): string {
  return FIXED_ORIGINS[scope] ?? FIXED_ORIGIN_DEFAULT;
}

/** Die Zeile „Art“ in den Details. */
export function transportLong(entry: McpConfigEntry): string {
  if (entry.transport === 'stdio') {
    return 'Programm (stdio)';
  }
  return transportShort(entry);
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

/** Die Zusammenfassung ohne Agenten. */
export function offlineSummaryText(total: number, enabled: number): string {
  return `${String(total)} Server · ${String(enabled)} eingeschaltet`;
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

function sourceTitle(source: McpSource): string {
  switch (source.kind) {
    case 'user':
      return 'Mein Benutzer';
    case 'repository':
      return `Projekt ${source.label}`;
    case 'workspace':
      return 'Vorhaben-Ordner';
    case 'local':
      return 'Nur ich, in diesem Vorhaben';
  }
}

function sourceWhere(source: McpSource): McpGroupWhere {
  switch (source.kind) {
    case 'user':
      return { reach: 'alle Vorhaben', file: source.file, suffix: '' };
    case 'repository':
      return { reach: 'geteilt im Repo', file: source.file, suffix: '' };
    case 'workspace':
      return { reach: 'nur dieses Vorhaben', file: source.file, suffix: '' };
    case 'local':
      return { reach: 'nicht geteilt', file: source.file, suffix: ' je Vorhaben' };
  }
}

function shadowedByTitle(config: McpConfigView, sourceId: string | null): string | null {
  const winner: McpSource | undefined = config.sources.find(
    (source: McpSource) => source.id === sourceId,
  );
  if (winner === undefined) {
    return null;
  }
  return sourceTitle(winner);
}

function transportShort(entry: McpConfigEntry): string {
  if (entry.transport === 'http' && entry.url?.startsWith('https:')) {
    return 'HTTPS';
  }
  return TRANSPORT_TEXTS[entry.transport];
}

/** Host der Adresse bzw. Programmname ohne Pfad. */
function shortTarget(entry: McpConfigEntry): string {
  if (entry.url !== null) {
    // Eine Adresse mit `${VARIABLE}` als Host ist nicht zerlegbar; dann steht sie ganz da.
    return URL.parse(entry.url)?.host ?? entry.url;
  }
  return entry.command?.split(/[\\/]/).pop() ?? '';
}

function countWithStatus(servers: readonly McpServer[], status: McpServerStatus): number {
  return servers.filter((server: McpServer) => server.status === status).length;
}
