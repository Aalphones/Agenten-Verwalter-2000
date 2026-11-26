import { formatCount } from '@/features/changes/changesScope';
import type { SessionFile } from '@/lib/bindings/SessionFile';
import type { SessionFileGroup } from '@/lib/bindings/SessionFileGroup';
import type { SessionFileOrigin } from '@/lib/bindings/SessionFileOrigin';
import type { SessionFilesListing } from '@/lib/bindings/SessionFilesListing';

const PLACES: readonly SessionFileOrigin[] = ['scratchpad', 'cliScratchpad', 'elsewhere'];

export const PLACE_LABELS: Readonly<Record<SessionFileOrigin, string>> = {
  scratchpad: 'Scratchpad',
  cliScratchpad: 'Scratchpad Kommandozeile',
  elsewhere: 'Weitere Orte',
};

const ELSEWHERE_TITLE = 'Dateien außerhalb der Scratchpads';
const TRUNCATED_TEXT = 'Nur die ersten 2.000 Einträge';
const NODE_KEY = 'sf';

const GROUP_DEPTH = 0;
const PLACE_DEPTH = 1;
const FOLDER_DEPTH = 2;

export type SessionRow =
  | { kind: 'sfHead'; key: string; depth: number; open: boolean; sub: string }
  | {
      kind: 'sfGroup';
      key: string;
      depth: number;
      open: boolean;
      group: SessionFileGroup;
      isOwn: boolean;
    }
  | {
      kind: 'sfPlace';
      key: string;
      depth: number;
      open: boolean;
      label: string;
      title: string;
      count: number;
    }
  | {
      kind: 'sfFolder';
      key: string;
      depth: number;
      open: boolean;
      label: string;
      /** Voller Pfad eines Ordners außerhalb der Scratchpads (Pfadzeile); sonst `null`. */
      farPath: string | null;
    }
  | { kind: 'sfFile'; key: string; depth: number; file: SessionFile; group: SessionFileGroup }
  | { kind: 'sfNote'; key: string; depth: number; text: string }
  | { kind: 'sfError'; key: string; depth: number; text: string };

export interface SessionRowsInput {
  listing: SessionFilesListing | null;
  /** Satz, wenn die Liste gar nicht gelesen werden konnte. */
  error: string | null;
  isLoading: boolean;
  /** ID der gefilterten Session; `null`: alle Gruppen. */
  filter: string | null;
  expanded: ReadonlySet<string>;
  /** Die Session, deren Chat neben dem Reiter steht; `null` in den Übersichten. */
  ownSessionId: string | null;
}

interface FolderNode {
  name: string;
  /** Pfad relativ zum Scratchpad mit `/`. */
  path: string;
  folders: Map<string, FolderNode>;
  files: SessionFile[];
}

interface GroupContext {
  group: SessionFileGroup;
  expanded: ReadonlySet<string>;
  rows: SessionRow[];
}

function groupKeyOf(sessionId: string): string {
  return `${NODE_KEY}|${sessionId}`;
}

function placeKeyOf(sessionId: string, origin: SessionFileOrigin): string {
  return `${groupKeyOf(sessionId)}|${origin}`;
}

export function sessionFileKey(sessionId: string, path: string): string {
  return `${groupKeyOf(sessionId)}|f|${path}`;
}

/** Eine Gruppe und ihre Orte: so viel ist bei der eigenen und bei der gefilterten Session offen. */
export function sessionGroupKeys(sessionId: string): string[] {
  return [
    groupKeyOf(sessionId),
    ...PLACES.map((origin: SessionFileOrigin) => placeKeyOf(sessionId, origin)),
  ];
}

/** Vorgabe beim ersten Öffnen: Knoten, eigene Gruppe und ihre Orte offen. */
export function defaultSessionExpanded(ownSessionId: string | null): string[] {
  return ownSessionId === null ? [NODE_KEY] : [NODE_KEY, ...sessionGroupKeys(ownSessionId)];
}

/** Alles, was offen sein muss, damit die Zeile der Datei im Baum steht. */
export function sessionRevealKeys(sessionId: string, file: SessionFile): string[] {
  const placeKey: string = placeKeyOf(sessionId, file.origin);
  const keys: string[] = [NODE_KEY, groupKeyOf(sessionId), placeKey];
  if (file.origin === 'elsewhere') {
    keys.push(`${placeKey}|${file.folder}`);
    return keys;
  }
  const parts: string[] = file.folder === '' ? [] : file.folder.split('/');
  for (let depth = 1; depth <= parts.length; depth += 1) {
    keys.push(`${placeKey}|${parts.slice(0, depth).join('/')}`);
  }
  return keys;
}

function countText(count: number, one: string, many: string): string {
  return `${formatCount(count)} ${count === 1 ? one : many}`;
}

/** Ein Satz des Core beginnt mit dem Namen des Ortes, an dem das Lesen scheiterte. */
function placeOfError(message: string): SessionFileOrigin | null {
  // Der längere Name zuerst: „Scratchpad Kommandozeile …“ beginnt auch mit „Scratchpad“.
  if (message.startsWith(PLACE_LABELS.cliScratchpad)) {
    return 'cliScratchpad';
  }
  return message.startsWith(PLACE_LABELS.scratchpad) ? 'scratchpad' : null;
}

function placeTitle(group: SessionFileGroup, origin: SessionFileOrigin): string {
  switch (origin) {
    case 'scratchpad':
      return group.scratchpadDir ?? PLACE_LABELS.scratchpad;
    case 'cliScratchpad':
      return group.cliScratchpadDir ?? PLACE_LABELS.cliScratchpad;
    case 'elsewhere':
      return ELSEWHERE_TITLE;
  }
}

function pushFile(context: GroupContext, file: SessionFile, depth: number): void {
  context.rows.push({
    kind: 'sfFile',
    key: sessionFileKey(context.group.sessionId, file.path),
    depth,
    file,
    group: context.group,
  });
}

function folderTree(files: readonly SessionFile[]): FolderNode {
  const root: FolderNode = { name: '', path: '', folders: new Map(), files: [] };
  for (const file of files) {
    const parts: string[] = file.folder === '' ? [] : file.folder.split('/');
    let node: FolderNode = root;
    parts.forEach((name: string, index: number) => {
      let next: FolderNode | undefined = node.folders.get(name);
      if (next === undefined) {
        const path: string = parts.slice(0, index + 1).join('/');
        next = { name, path, folders: new Map(), files: [] };
        node.folders.set(name, next);
      }
      node = next;
    });
    node.files.push(file);
  }
  return root;
}

/** Ordner vor Dateien, beides in der Reihenfolge des Core; eine Kette aus Ordnern mit je einem Unterordner
 *  wird eine Zeile. */
function pushFolder(
  context: GroupContext,
  placeKey: string,
  folder: FolderNode,
  depth: number,
): void {
  for (const child of folder.folders.values()) {
    let end: FolderNode = child;
    const names: string[] = [end.name];
    while (end.files.length === 0 && end.folders.size === 1) {
      const [only] = end.folders.values();
      if (only === undefined) {
        break;
      }
      end = only;
      names.push(end.name);
    }
    const key = `${placeKey}|${end.path}`;
    const isOpen: boolean = context.expanded.has(key);
    context.rows.push({
      kind: 'sfFolder',
      key,
      depth,
      open: isOpen,
      label: names.join(' / '),
      farPath: null,
    });
    if (isOpen) {
      pushFolder(context, placeKey, end, depth + 1);
    }
  }
  for (const file of folder.files) {
    pushFile(context, file, depth);
  }
}

/** „Weitere Orte“: flach, je Elternordner eine Zeile mit dem vollen Pfad. */
function pushElsewhere(
  context: GroupContext,
  placeKey: string,
  files: readonly SessionFile[],
): void {
  const byFolder = new Map<string, SessionFile[]>();
  for (const file of files) {
    const list: SessionFile[] = byFolder.get(file.folder) ?? [];
    list.push(file);
    byFolder.set(file.folder, list);
  }
  for (const [folder, list] of byFolder) {
    const key = `${placeKey}|${folder}`;
    const isOpen: boolean = context.expanded.has(key);
    context.rows.push({
      kind: 'sfFolder',
      key,
      depth: FOLDER_DEPTH,
      open: isOpen,
      label: folder,
      farPath: folder,
    });
    if (isOpen) {
      for (const file of list) {
        pushFile(context, file, FOLDER_DEPTH + 1);
      }
    }
  }
}

function pushPlace(context: GroupContext, origin: SessionFileOrigin): void {
  const files: SessionFile[] = context.group.files.filter(
    (file: SessionFile) => file.origin === origin,
  );
  const errors: string[] = context.group.errors.filter(
    (message: string) => placeOfError(message) === origin,
  );
  if (files.length === 0 && errors.length === 0) {
    return;
  }
  const key: string = placeKeyOf(context.group.sessionId, origin);
  const isOpen: boolean = context.expanded.has(key);
  context.rows.push({
    kind: 'sfPlace',
    key,
    depth: PLACE_DEPTH,
    open: isOpen,
    label: PLACE_LABELS[origin],
    title: placeTitle(context.group, origin),
    count: files.length,
  });
  if (!isOpen) {
    return;
  }
  errors.forEach((message: string, index: number) => {
    context.rows.push({
      kind: 'sfError',
      key: `${key}|error|${String(index)}`,
      depth: FOLDER_DEPTH,
      text: message,
    });
  });
  if (origin === 'elsewhere') {
    pushElsewhere(context, key, files);
  } else {
    pushFolder(context, key, folderTree(files), FOLDER_DEPTH);
  }
}

function pushGroup(context: GroupContext, ownSessionId: string | null): void {
  const { group } = context;
  const key: string = groupKeyOf(group.sessionId);
  const isOpen: boolean = context.expanded.has(key);
  context.rows.push({
    kind: 'sfGroup',
    key,
    depth: GROUP_DEPTH,
    open: isOpen,
    group,
    isOwn: group.sessionId === ownSessionId,
  });
  if (!isOpen) {
    return;
  }
  group.errors
    .filter((message: string) => placeOfError(message) === null)
    .forEach((message: string, index: number) => {
      context.rows.push({
        kind: 'sfError',
        key: `${key}|error|${String(index)}`,
        depth: PLACE_DEPTH,
        text: message,
      });
    });
  for (const origin of PLACES) {
    pushPlace(context, origin);
  }
  if (group.truncated) {
    context.rows.push({
      kind: 'sfNote',
      key: `${key}|note`,
      depth: PLACE_DEPTH,
      text: TRUNCATED_TEXT,
    });
  }
}

function headRow(sub: string, isOpen: boolean): SessionRow {
  return { kind: 'sfHead', key: NODE_KEY, depth: 0, open: isOpen, sub };
}

/** Die Zeilen des Knotens „Session-Dateien“; leer, wenn es nichts zu zeigen gibt. */
export function buildSessionRows({
  listing,
  error,
  isLoading,
  filter,
  expanded,
  ownSessionId,
}: SessionRowsInput): SessionRow[] {
  const isOpen: boolean = expanded.has(NODE_KEY);
  if (isLoading) {
    return [headRow('werden gelesen …', isOpen)];
  }
  if (listing === null) {
    if (error === null) {
      return [];
    }
    const failed: SessionRow = headRow('nicht gelesen', isOpen);
    return isOpen
      ? [failed, { kind: 'sfError', key: `${NODE_KEY}|error`, depth: GROUP_DEPTH, text: error }]
      : [failed];
  }
  const groups: SessionFileGroup[] = listing.groups.filter(
    (group: SessionFileGroup) => filter === null || group.sessionId === filter,
  );
  if (groups.length === 0) {
    return [];
  }
  let fileCount = 0;
  for (const group of groups) {
    fileCount += group.files.length;
  }
  const sub = `${countText(groups.length, 'Session', 'Sessions')} · ${countText(fileCount, 'Datei', 'Dateien')}`;
  const rows: SessionRow[] = [headRow(sub, isOpen)];
  if (isOpen) {
    for (const group of groups) {
      pushGroup({ group, expanded, rows }, ownSessionId);
    }
  }
  return rows;
}
