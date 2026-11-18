import { EMPTY_SCOPE_TEXT, formatCount } from '@/features/changes/changesScope';
import type { MergedFile, RepoGroup } from '@/features/files/mergeGroups';
import type { ChangeScope } from '@/lib/bindings/ChangeScope';
import type { DirEntry } from '@/lib/bindings/DirEntry';
import type { RepoTree } from '@/lib/bindings/RepoTree';
import type { FilesMode } from '@/stores/files';

/** Höchstzahl der Dateien je Baum (`files::tree::MAX_TREE_FILES` im Core). */
const MAX_TREE_FILES = 50_000;

/** Ordnerebenen, die in „Geändert“ ohne Zutun offen stehen. */
const DEFAULT_OPEN_LEVELS = 2;

export type LoadState<T> =
  { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; value: T };

export type TreeRow =
  | { kind: 'group'; key: string; group: RepoGroup; open: boolean }
  | {
      kind: 'dir';
      key: string;
      group: string;
      path: string;
      label: string;
      depth: number;
      open: boolean;
      /** Geänderte Dateien darunter. */
      count: number;
    }
  | {
      kind: 'file';
      key: string;
      group: string;
      path: string;
      name: string;
      depth: number;
      file: MergedFile | null;
      link: boolean;
    }
  | {
      kind: 'ignored';
      key: string;
      group: string;
      /** Eintrag, in dessen Ordner der ignorierte Pfad liegt (Anker). */
      entryKey: string;
      path: string;
      name: string;
      depth: number;
      dir: boolean;
      link: boolean;
      open: boolean;
    }
  | { kind: 'note'; key: string; text: string; depth: number }
  | { kind: 'error'; key: string; text: string; depth: number };

export interface TreeRowsInput {
  groups: readonly RepoGroup[];
  mode: FilesMode;
  scope: ChangeScope;
  expanded: ReadonlySet<string>;
  /** Je Anker-Schlüssel der geladene Baum (nur „Alle Dateien“). */
  trees: ReadonlyMap<string, LoadState<RepoTree>>;
  /** Je `<Anker>|<Pfad>` die Kinder eines ignorierten Ordners. */
  ignoredChildren: ReadonlyMap<string, LoadState<DirEntry[]>>;
}

interface IgnoredItem {
  name: string;
  dir: boolean;
  link: boolean;
}

interface DirNode {
  name: string;
  path: string;
  dirs: Map<string, DirNode>;
  files: { name: string; link: boolean }[];
  ignored: IgnoredItem[];
  count: number;
}

export function expandKey(group: string, path: string): string {
  return `${group}:${path}`;
}

export function ignoredKey(entryKey: string, path: string): string {
  return `${entryKey}|${path}`;
}

/** Ordner ohne Groß-/Kleinschreibung sortiert; `Readme.md` und `README.md` bleiben zwei Einträge. */
function byName(first: string, second: string): number {
  return first.localeCompare(second, 'de', { sensitivity: 'base' }) || (first < second ? -1 : 1);
}

function newDir(name: string, path: string): DirNode {
  return { name, path, dirs: new Map(), files: [], ignored: [], count: 0 };
}

/** Der Ordner zu den ersten `upTo` Teilen; `changed` zählt auf dem Weg jeden Ordner hoch. */
function dirFor(root: DirNode, parts: readonly string[], upTo: number, changed: boolean): DirNode {
  let node: DirNode = root;
  for (let index = 0; index < upTo; index += 1) {
    const name: string = parts[index] ?? '';
    let next: DirNode | undefined = node.dirs.get(name);
    if (next === undefined) {
      next = newDir(name, parts.slice(0, index + 1).join('/'));
      node.dirs.set(name, next);
    }
    node = next;
    if (changed) {
      node.count += 1;
    }
  }
  return node;
}

function buildDirTree(
  paths: readonly { path: string; link: boolean }[],
  group: RepoGroup,
  ignored: readonly { path: string; dir: boolean }[],
): DirNode {
  const root: DirNode = newDir('', '');
  for (const { path, link } of paths) {
    const parts: string[] = path.split('/');
    const isChanged: boolean = group.byPath.has(path);
    if (isChanged) {
      root.count += 1;
    }
    dirFor(root, parts, parts.length - 1, isChanged).files.push({
      name: parts[parts.length - 1] ?? path,
      link,
    });
  }
  for (const entry of ignored) {
    const parts: string[] = entry.path.split('/');
    dirFor(root, parts, parts.length - 1, false).ignored.push({
      name: parts[parts.length - 1] ?? entry.path,
      dir: entry.dir,
      link: false,
    });
  }
  return root;
}

interface WalkContext {
  group: RepoGroup;
  expanded: ReadonlySet<string>;
  ignoredChildren: ReadonlyMap<string, LoadState<DirEntry[]>>;
  rows: TreeRow[];
}

function pushIgnored(
  context: WalkContext,
  parentPath: string,
  item: IgnoredItem,
  depth: number,
): void {
  const { group, expanded, ignoredChildren, rows } = context;
  const path: string = parentPath === '' ? item.name : `${parentPath}/${item.name}`;
  const open: boolean = item.dir && expanded.has(expandKey(group.group, path));
  rows.push({
    kind: 'ignored',
    key: `${group.group}|i|${path}`,
    group: group.group,
    entryKey: group.anchorKey,
    path,
    name: item.name,
    depth,
    dir: item.dir,
    link: item.link,
    open,
  });
  if (!open) {
    return;
  }
  const children: LoadState<DirEntry[]> | undefined = ignoredChildren.get(
    ignoredKey(group.anchorKey, path),
  );
  if (children === undefined || children.status === 'loading') {
    rows.push({
      kind: 'note',
      key: `${group.group}|in|${path}`,
      text: 'Wird gelesen …',
      depth: depth + 1,
    });
    return;
  }
  if (children.status === 'error') {
    rows.push({
      kind: 'error',
      key: `${group.group}|ie|${path}`,
      text: children.message,
      depth: depth + 1,
    });
    return;
  }
  if (children.value.length === 0) {
    rows.push({ kind: 'note', key: `${group.group}|in|${path}`, text: 'Leer', depth: depth + 1 });
  }
  for (const child of children.value) {
    pushIgnored(context, path, { name: child.name, dir: child.dir, link: child.link }, depth + 1);
  }
}

function walk(context: WalkContext, node: DirNode, depth: number): void {
  const { group, expanded, rows } = context;
  const dirs: DirNode[] = [...node.dirs.values()].sort((first: DirNode, second: DirNode) =>
    byName(first.name, second.name),
  );
  for (const start of dirs) {
    let dir: DirNode = start;
    let label: string = dir.name;
    // Ordnerketten mit genau einem Unterordner und sonst nichts stehen in einer Zeile.
    for (;;) {
      const only: DirNode | undefined =
        dir.files.length === 0 && dir.ignored.length === 0 && dir.dirs.size === 1
          ? [...dir.dirs.values()][0]
          : undefined;
      if (only === undefined) {
        break;
      }
      dir = only;
      label = `${label}/${dir.name}`;
    }
    const open: boolean = expanded.has(expandKey(group.group, dir.path));
    rows.push({
      kind: 'dir',
      key: `${group.group}|d|${dir.path}`,
      group: group.group,
      path: dir.path,
      label,
      depth,
      open,
      count: dir.count,
    });
    if (open) {
      walk(context, dir, depth + 1);
    }
  }
  const ignored: IgnoredItem[] = [...node.ignored].sort((first: IgnoredItem, second: IgnoredItem) =>
    byName(first.name, second.name),
  );
  for (const item of ignored.filter((entry: IgnoredItem) => entry.dir)) {
    pushIgnored(context, node.path, item, depth);
  }
  const files = [...node.files].sort((first, second) => byName(first.name, second.name));
  for (const file of files) {
    const path: string = node.path === '' ? file.name : `${node.path}/${file.name}`;
    rows.push({
      kind: 'file',
      key: `${group.group}|f|${path}`,
      group: group.group,
      path,
      name: file.name,
      depth,
      file: group.byPath.get(path) ?? null,
      link: file.link,
    });
  }
  for (const item of ignored.filter((entry: IgnoredItem) => !entry.dir)) {
    pushIgnored(context, node.path, item, depth);
  }
}

function changedPaths(group: RepoGroup): { path: string; link: boolean }[] {
  return group.files.map((file: MergedFile) => ({ path: file.path, link: false }));
}

function pushGroupBody(input: TreeRowsInput, group: RepoGroup, rows: TreeRow[]): void {
  const { mode, scope, expanded, trees, ignoredChildren } = input;
  const note = (suffix: string, text: string): void => {
    rows.push({ kind: 'note', key: `${group.group}|n|${suffix}`, text, depth: 1 });
  };
  if (mode === 'changed') {
    if (group.files.length === 0) {
      note(
        'empty',
        scope === 'uncommitted' ? 'Nichts offen – alles committed.' : EMPTY_SCOPE_TEXT[scope],
      );
      return;
    }
    walk(
      { group, expanded, ignoredChildren, rows },
      buildDirTree(changedPaths(group), group, []),
      1,
    );
    return;
  }
  const tree: LoadState<RepoTree> | undefined = trees.get(group.anchorKey);
  if (tree === undefined || tree.status === 'loading') {
    note('loading', 'Dateien werden gelesen …');
    return;
  }
  if (tree.status === 'error') {
    rows.push({ kind: 'error', key: `${group.group}|n|tree`, text: tree.message, depth: 1 });
    return;
  }
  // Ein gelöschter, geänderter Pfad fehlt im Ordner, steht aber im Baum.
  const known = new Set<string>(tree.value.files.map((file) => file.path));
  const paths: { path: string; link: boolean }[] = [...tree.value.files];
  for (const file of group.files) {
    if (!known.has(file.path)) {
      paths.push({ path: file.path, link: false });
    }
  }
  walk(
    { group, expanded, ignoredChildren, rows },
    buildDirTree(paths, group, tree.value.ignored),
    1,
  );
  if (tree.value.truncated) {
    note('truncated', `Nur die ersten ${formatCount(MAX_TREE_FILES)} Dateien`);
  }
}

/** Die Zeilenliste des Baums: je Knoten seine Kopfzeile, darunter Fehler, Ordner, Dateien und Hinweise. */
export function buildTreeRows(input: TreeRowsInput): TreeRow[] {
  const rows: TreeRow[] = [];
  for (const group of input.groups) {
    const open: boolean = input.expanded.has(expandKey(group.group, ''));
    rows.push({ kind: 'group', key: `${group.group}|g`, group, open });
    for (const error of group.errors) {
      rows.push({
        kind: 'error',
        key: `${group.group}|e|${error.entryKey}`,
        text: error.message,
        depth: 1,
      });
    }
    if (open) {
      pushGroupBody(input, group, rows);
    }
  }
  return rows;
}

/** Die Ordner über einem Pfad als Aufklapp-Schlüssel, höchstens `levels` Ebenen tief. */
export function ancestorKeys(group: string, path: string, levels: number): string[] {
  const parts: string[] = path.split('/');
  const keys: string[] = [];
  for (let index = 1; index < parts.length && index <= levels; index += 1) {
    keys.push(expandKey(group, parts.slice(0, index).join('/')));
  }
  return keys;
}

/** Vorgabe, solange noch nichts angefasst ist: alle Knoten offen, in „Geändert“ dazu die ersten zwei Ordnerzeilen
 *  (eine verkürzte Kette wie `app/src/main` zählt als eine Zeile). */
export function defaultExpanded(groups: readonly RepoGroup[], mode: FilesMode): string[] {
  const keys: string[] = [];
  for (const group of groups) {
    keys.push(expandKey(group.group, ''));
    if (mode !== 'changed') {
      continue;
    }
    const rows: TreeRow[] = [];
    walk(
      {
        group,
        expanded: new Set(expandAllKeys([group])),
        ignoredChildren: new Map(),
        rows,
      },
      buildDirTree(changedPaths(group), group, []),
      1,
    );
    for (const row of rows) {
      if (row.kind === 'dir' && row.depth <= DEFAULT_OPEN_LEVELS) {
        keys.push(expandKey(group.group, row.path));
      }
    }
  }
  return [...new Set(keys)];
}

/** „Aufklappen“: Knoten und alle Ordner über geänderten Dateien. */
export function expandAllKeys(groups: readonly RepoGroup[]): string[] {
  const keys: string[] = [];
  for (const group of groups) {
    keys.push(expandKey(group.group, ''));
    for (const file of group.files) {
      keys.push(...ancestorKeys(group.group, file.path, Number.POSITIVE_INFINITY));
    }
  }
  return [...new Set(keys)];
}

/** „Einklappen“: nur die Knoten bleiben offen. */
export function collapseAllKeys(groups: readonly RepoGroup[]): string[] {
  return groups.map((group: RepoGroup) => expandKey(group.group, ''));
}
