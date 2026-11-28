import type { McpDraft } from '@/lib/bindings/McpDraft';
import type { McpPairDraft } from '@/lib/bindings/McpPairDraft';
import type { McpTransport } from '@/lib/bindings/McpTransport';

const QUOTES: readonly string[] = ['"', "'"];

const JSON_TRANSPORTS: Readonly<Record<string, McpTransport>> = {
  stdio: 'stdio',
  http: 'http',
  'streamable-http': 'http',
  sse: 'sse',
};

export type McpJsonResult = { drafts: McpDraft[] } | { error: string };

/** Zerlegt eine Befehlszeile an Leerzeichen; Anführungszeichen halten zusammen und fallen weg.
 *  Rückwärtsschrägstriche bleiben stehen (Windows-Pfade). */
export function splitCommand(line: string): string[] {
  const parts: string[] = [];
  let current: string | null = null;
  let openQuote: string | null = null;
  for (const character of line) {
    if (openQuote !== null) {
      if (character === openQuote) {
        openQuote = null;
      } else {
        current = (current ?? '') + character;
      }
    } else if (QUOTES.includes(character)) {
      openQuote = character;
      current ??= '';
    } else if (/\s/.test(character)) {
      if (current !== null) {
        parts.push(current);
      }
      current = null;
    } else {
      current = (current ?? '') + character;
    }
  }
  if (current !== null) {
    parts.push(current);
  }
  return parts;
}

/** Gegenstück zu `splitCommand`: dieselben Teile kommen beim Zerlegen wieder heraus. */
export function joinCommand(parts: readonly string[]): string {
  return parts.map(quotePart).join(' ');
}

function quotePart(part: string): string {
  if (part !== '' && !/[\s"']/.test(part)) {
    return part;
  }
  if (!part.includes('"')) {
    return `"${part}"`;
  }
  // Beide Arten im selben Teil: die doppelten einzeln in einfache fassen.
  return `'${part.split("'").join(`'"'"'`)}'`;
}

/** Liest `{"mcpServers":{…}}` oder ein einzelnes `{"name":{…}}` als Entwürfe für die Quelle
 *  `sourceId`. Die Fehlersätze nennen nie Inhalt der Eingabe außer Namen und Schlüsseln: in den
 *  Werten stehen Zugangsdaten. */
export function parseMcpJson(text: string, sourceId: string): McpJsonResult {
  if (text.trim() === '') {
    return { error: 'JSON fehlt.' };
  }
  let root: unknown;
  try {
    root = JSON.parse(text);
  } catch {
    // Die Meldung des Parsers zitiert die Eingabe und bleibt deshalb weg.
    return { error: 'Das ist kein gültiges JSON – Klammern, Kommas und Anführungszeichen prüfen.' };
  }
  if (!isObject(root)) {
    return { error: 'Erwartet wird ein Objekt wie { "mcpServers": { … } }.' };
  }
  const isWrapped: boolean = isObject(root.mcpServers);
  const servers: [string, unknown][] = Object.entries(
    isObject(root.mcpServers) ? root.mcpServers : root,
  );
  if (servers.length === 0) {
    return { error: 'Darin steht kein Server.' };
  }
  if (!isWrapped && (servers.length > 1 || !isObject(servers[0]?.[1]))) {
    return { error: 'Der Name des Servers fehlt: erwartet wird { "name": { … } }.' };
  }
  const drafts: McpDraft[] = [];
  for (const [name, entry] of servers) {
    const draft: McpDraft | string = toDraft(name, entry, sourceId);
    if (typeof draft === 'string') {
      return { error: `„${name}“: ${draft}` };
    }
    drafts.push(draft);
  }
  return { drafts };
}

/** Der Entwurf zu einem Eintrag oder der Satz, woran er scheitert. */
function toDraft(name: string, entry: unknown, sourceId: string): McpDraft | string {
  if (!isObject(entry)) {
    return 'Der Eintrag ist kein Objekt.';
  }
  const transport: McpTransport | undefined = transportOf(entry);
  if (transport === undefined) {
    return 'Art unbekannt – „type“ ist stdio, http oder sse; ohne „type“ braucht es „command“ oder „url“.';
  }
  const isProgram: boolean = transport === 'stdio';
  const url: unknown = entry.url;
  const command: unknown = entry.command;
  const args: unknown = entry.args ?? [];
  if (isProgram && (typeof command !== 'string' || command.trim() === '')) {
    return 'Befehl fehlt.';
  }
  if (!isProgram && (typeof url !== 'string' || url.trim() === '')) {
    return 'Adresse fehlt.';
  }
  if (!Array.isArray(args) || !args.every((arg: unknown) => typeof arg === 'string')) {
    return '„args“ muss eine Liste von Texten sein.';
  }
  const pairsKey: string = isProgram ? 'env' : 'headers';
  const pairs: McpPairDraft[] | null = pairsOf(entry[pairsKey] ?? {});
  if (pairs === null) {
    return `„${pairsKey}“ muss ein Objekt mit Texten als Werten sein.`;
  }
  return {
    sourceId,
    originalName: null,
    originalSourceId: null,
    name,
    transport,
    url: !isProgram && typeof url === 'string' ? url : null,
    command: isProgram && typeof command === 'string' ? command : null,
    args: isProgram ? args : [],
    pairs,
  };
}

function transportOf(entry: Record<string, unknown>): McpTransport | undefined {
  if (typeof entry.type === 'string') {
    return JSON_TRANSPORTS[entry.type];
  }
  if (entry.command !== undefined) {
    return 'stdio';
  }
  if (entry.url !== undefined) {
    return 'http';
  }
  return undefined;
}

function pairsOf(value: unknown): McpPairDraft[] | null {
  if (!isObject(value)) {
    return null;
  }
  const pairs: McpPairDraft[] = [];
  for (const [key, text] of Object.entries(value)) {
    if (typeof text !== 'string') {
      return null;
    }
    pairs.push({ key, value: text });
  }
  return pairs;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
