import { joinCommand, splitCommand } from '@/features/mcp/parseMcpJson';
import type { McpConfigEntry } from '@/lib/bindings/McpConfigEntry';
import type { McpConfigView } from '@/lib/bindings/McpConfigView';
import type { McpDraft } from '@/lib/bindings/McpDraft';
import type { McpPair } from '@/lib/bindings/McpPair';
import type { McpPairDraft } from '@/lib/bindings/McpPairDraft';
import type { McpSource } from '@/lib/bindings/McpSource';
import type { McpTransport } from '@/lib/bindings/McpTransport';
import {
  ADDRESS_MISSING,
  COMMAND_MISSING,
  NAME_INVALID,
  NAME_MISSING,
  NAME_TAKEN,
  pairValueMissing,
} from '@/features/mcp/mcpFormTexts';

/** Dieselbe Regel wie im Core. */
const NAME_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
const VARIABLE_PATTERN = /^\$\{[A-Za-z_][A-Za-z0-9_]*\}$/;

export const USER_SOURCE_ID = 'user';
export const LOCAL_SOURCE_ID = 'local';

export type McpFormMode = 'fields' | 'json';

/** Womit das Formular öffnet: neu mit vorbelegtem Ziel oder ein vorhandener Eintrag. */
export type McpFormTarget =
  { kind: 'add'; sourceId: string } | { kind: 'edit'; sourceId: string; entry: McpConfigEntry };

export interface McpPairRow {
  id: number;
  key: string;
  value: string;
  isSecret: boolean;
  /** Schlüssel eines verborgenen Werts im bearbeiteten Eintrag; leer gelassen bleibt der Wert. */
  hiddenKey: string | null;
}

export interface McpFormState {
  sourceId: string;
  mode: McpFormMode;
  name: string;
  transport: McpTransport;
  /** Adresse und Befehlszeile getrennt: der Wechsel der Art vermischt sie nicht. */
  url: string;
  commandLine: string;
  rows: McpPairRow[];
  json: string;
}

export interface McpFieldErrors {
  name: string | null;
  connection: string | null;
  /** Ein Satz zu den Header- bzw. Umgebungszeilen. */
  pairs: string | null;
}

export function emptyRow(id: number): McpPairRow {
  return { id, key: '', value: '', isSecret: false, hiddenKey: null };
}

/** Vorbelegtes Ziel beim Hinzufügen: das erste Repository, sonst der Benutzer. */
export function defaultSourceId(config: McpConfigView): string {
  const repository: McpSource | undefined = config.sources.find(
    (source: McpSource) => source.kind === 'repository',
  );
  return repository?.id ?? USER_SOURCE_ID;
}

export function initialFormState(target: McpFormTarget): McpFormState {
  const empty: McpFormState = {
    sourceId: target.sourceId,
    mode: 'fields',
    name: '',
    transport: 'http',
    url: '',
    commandLine: '',
    rows: [emptyRow(0)],
    json: '',
  };
  if (target.kind === 'add') {
    return empty;
  }
  const entry: McpConfigEntry = target.entry;
  const rows: McpPairRow[] = entry.pairs.map((pair: McpPair, index: number) => ({
    id: index,
    key: pair.key,
    value: pair.value ?? '',
    isSecret: pair.value === null,
    hiddenKey: pair.value === null ? pair.key : null,
  }));
  return {
    ...empty,
    name: entry.name,
    transport: entry.transport === 'other' ? 'http' : entry.transport,
    url: entry.url ?? '',
    commandLine: entry.command === null ? '' : joinCommand([entry.command, ...entry.args]),
    rows: rows.length > 0 ? rows : empty.rows,
  };
}

/** Ob die Zeile den gespeicherten, verborgenen Wert behalten kann: nur unter demselben Schlüssel
 *  und solange Header nicht zu Umgebungsvariablen werden (oder umgekehrt). */
export function keepsHiddenValue(
  row: McpPairRow,
  transport: McpTransport,
  target: McpFormTarget,
): boolean {
  return (
    target.kind === 'edit' &&
    row.hiddenKey !== null &&
    row.key.trim() === row.hiddenKey &&
    (transport === 'stdio') === (target.entry.transport === 'stdio')
  );
}

export function draftFromFields(state: McpFormState, target: McpFormTarget): McpDraft {
  const isProgram: boolean = state.transport === 'stdio';
  const [command, ...args] = splitCommand(state.commandLine);
  const pairs: McpPairDraft[] = state.rows
    .filter((row: McpPairRow) => row.key.trim() !== '')
    .map((row: McpPairRow) => ({
      key: row.key.trim(),
      value: row.value === '' && keepsHiddenValue(row, state.transport, target) ? null : row.value,
    }));
  return {
    ...originOf(target, state.sourceId),
    sourceId: state.sourceId,
    name: state.name.trim(),
    transport: state.transport,
    url: isProgram ? null : state.url.trim(),
    command: isProgram ? (command ?? '') : null,
    args: isProgram ? args : [],
    pairs,
  };
}

/** Welchen Eintrag ein Entwurf ersetzt; `originalSourceId` nur, wenn er die Quelle wechselt. */
export function originOf(
  target: McpFormTarget,
  sourceId: string,
): Pick<McpDraft, 'originalName' | 'originalSourceId'> {
  if (target.kind === 'add') {
    return { originalName: null, originalSourceId: null };
  }
  return {
    originalName: target.entry.name,
    originalSourceId: target.sourceId === sourceId ? null : target.sourceId,
  };
}

/** Ob `name` in der Zielquelle schon vergeben ist; der bearbeitete Eintrag selbst zählt nicht. */
export function isNameTaken(
  config: McpConfigView,
  target: McpFormTarget,
  sourceId: string,
  name: string,
): boolean {
  if (target.kind === 'edit' && target.sourceId === sourceId && target.entry.name === name) {
    return false;
  }
  return config.sources.some(
    (source: McpSource) =>
      source.id === sourceId && source.servers.some((entry: McpConfigEntry) => entry.name === name),
  );
}

export function nameError(
  config: McpConfigView,
  target: McpFormTarget,
  sourceId: string,
  name: string,
): string | null {
  if (name === '') {
    return NAME_MISSING;
  }
  // Ein bestehender Name darf bleiben, auch wenn er für neue Server nicht gälte.
  const isUnchanged: boolean = target.kind === 'edit' && target.entry.name === name;
  if (!isUnchanged && !NAME_PATTERN.test(name)) {
    return NAME_INVALID;
  }
  if (isNameTaken(config, target, sourceId, name)) {
    return NAME_TAKEN;
  }
  return null;
}

export function fieldErrors(
  config: McpConfigView,
  state: McpFormState,
  target: McpFormTarget,
): McpFieldErrors {
  const draft: McpDraft = draftFromFields(state, target);
  let connection: string | null = null;
  if (draft.transport === 'stdio') {
    if ((draft.command ?? '').trim() === '') {
      connection = COMMAND_MISSING;
    }
  } else if (draft.url === '') {
    connection = ADDRESS_MISSING;
  }
  // Ein verborgener Wert, dessen Zeile ihn nicht mehr behalten kann, darf nicht still leer werden.
  const lost: McpPairRow | undefined = state.rows.find(
    (row: McpPairRow) =>
      row.key.trim() !== '' &&
      row.hiddenKey !== null &&
      row.value === '' &&
      !keepsHiddenValue(row, state.transport, target),
  );
  return {
    name: nameError(config, target, state.sourceId, draft.name),
    connection,
    pairs: lost === undefined ? null : pairValueMissing(lost.key.trim()),
  };
}

/** Ob ein als geheim markierter Klartext-Wert in der geteilten Datei eines Repositorys landet. */
export function putsSecretIntoRepository(
  config: McpConfigView,
  state: McpFormState,
  target: McpFormTarget,
): boolean {
  const isRepository: boolean = config.sources.some(
    (source: McpSource) => source.id === state.sourceId && source.kind === 'repository',
  );
  return (
    isRepository &&
    state.rows.some((row: McpPairRow) => {
      if (!row.isSecret || row.key.trim() === '') {
        return false;
      }
      if (row.value === '') {
        return keepsHiddenValue(row, state.transport, target);
      }
      return !VARIABLE_PATTERN.test(row.value);
    })
  );
}
