import { entryKindLabel } from '@/features/git/gitTexts';
import { EMPTY_SCOPE_TEXT, statOf, sumLines, type LineSums } from '@/features/changes/changesScope';
import type { ChangeKind } from '@/lib/bindings/ChangeKind';
import type { ChangeScope } from '@/lib/bindings/ChangeScope';
import type { FileChange } from '@/lib/bindings/FileChange';
import type { GitEntryStatus } from '@/lib/bindings/GitEntryStatus';
import type { GitForeignFile } from '@/lib/bindings/GitForeignFile';
import type { GitOwnCommit } from '@/lib/bindings/GitOwnCommit';
import type { GitSessionStatus } from '@/lib/bindings/GitSessionStatus';
import type { LineStat } from '@/lib/bindings/LineStat';
import type { RepositoryChanges } from '@/lib/bindings/RepositoryChanges';
import type { SessionChanges } from '@/lib/bindings/SessionChanges';

const NOTHING_OPEN_TEXT = 'Nichts offen.';

/** Was die Git-Bedienung an einer Repository-Zeile braucht. */
export interface GitRepositoryRow {
  entry: GitEntryStatus;
  /** Alle ungecommitteten Pfade des Eintrags, eigene und fremde. */
  dirtyPaths: readonly string[];
  isCollapsed: boolean;
  /** Haupt-Checkout, Ticket-Worktree oder inneres Repository. */
  kindLabel: string;
}

/** Der Git-Zustand, aus dem die Session-Reichweite zusätzliche Zeilen baut. */
export interface GitRowsInput {
  status: GitSessionStatus;
  collapsed: Readonly<Record<string, boolean>>;
  showForeign: Readonly<Record<string, boolean>>;
}

export type GitGroup = 'uncommitted' | 'committed';

/** `key` ist der React-Schlüssel der Zeile, `entryKey` der `key` des Eintrags aus `RepositoryChanges`. */
export type FileRow =
  | {
      kind: 'repository';
      key: string;
      entryKey: string;
      name: string;
      added: number;
      deleted: number;
      isFirst: boolean;
      /** Gesetzt nur in der Session-Reichweite und bei lesbarem Eintrag. */
      git: GitRepositoryRow | null;
    }
  | { kind: 'branch'; key: string; branch: string }
  | { kind: 'error'; key: string; message: string }
  | { kind: 'folder'; key: string; label: string; depth: number }
  | {
      kind: 'file';
      key: string;
      entryKey: string;
      path: string;
      label: string;
      depth: number;
      stat: LineStat;
      isUncommitted: boolean;
      /** Häkchen: eigene Datei (standardmäßig an), fremde (aus) oder keins. */
      checkable: 'own' | 'foreign' | null;
      /** Blickwinkel, in dem der Diff der Datei öffnet; `null`: der gewählte Blickwinkel. */
      scope: ChangeScope | null;
    }
  | { kind: 'operation'; key: string; entryKey: string; entry: GitEntryStatus }
  | {
      kind: 'commitBox';
      key: string;
      entryKey: string;
      entry: GitEntryStatus;
      ownPaths: readonly string[];
      foreignPaths: readonly string[];
    }
  | {
      kind: 'group';
      key: string;
      entryKey: string;
      group: GitGroup;
      count: number;
      /** „Uncommitted“: die eigenen Pfade für „alle vormerken“. */
      ownPaths: readonly string[];
      /** „Committed“: mindestens ein eigener Commit ist noch nicht gepusht. */
      hasUnpushed: boolean;
    }
  | { kind: 'note'; key: string; text: string }
  | { kind: 'foreignToggle'; key: string; entryKey: string; count: number; isOpen: boolean }
  | { kind: 'commit'; key: string; entryKey: string; commit: GitOwnCommit }
  | {
      kind: 'commitFile';
      key: string;
      entryKey: string;
      path: string;
      name: string;
      directory: string;
      change: ChangeKind | null;
    };

/** Die Zeilen des Dateibaums. Ohne `git` (Reichweite Projekt): je Repository Kopf, Branch und der Baum der
 *  Dateien im Blickwinkel. Mit `git`: je Eintrag Kopf mit Git-Leiste, Commit-Feld und die Gruppen
 *  „Uncommitted“ und „Committed“. */
export function buildFileRows(
  changes: SessionChanges,
  repositoryFilter: string | null,
  scope: ChangeScope,
  git: GitRowsInput | null,
): FileRow[] {
  const rows: FileRow[] = [];
  for (const repository of changes.repositories) {
    if (repositoryFilter !== null && repository.key !== repositoryFilter) {
      continue;
    }
    const entry: GitEntryStatus | undefined =
      git === null
        ? undefined
        : git.status.entries.find((candidate: GitEntryStatus) => candidate.key === repository.key);
    if (git !== null && entry !== undefined && entry.error === null) {
      appendGitRepository(rows, repository, entry, scope, git);
    } else {
      appendRepository(rows, repository, scope);
    }
  }
  return rows;
}

function appendRepository(
  rows: FileRow[],
  repository: RepositoryChanges,
  scope: ChangeScope,
): void {
  const { key } = repository;
  if (repository.error !== null) {
    rows.push(repositoryRow(rows, repository, { added: 0, deleted: 0 }, null));
    rows.push({ kind: 'branch', key: `${key}:branch`, branch: repository.branch });
    rows.push({ kind: 'error', key: `${key}:error`, message: repository.error });
    return;
  }
  const visible: FileChange[] = repository.files.filter(
    (file: FileChange) => statOf(file, scope) !== null,
  );
  if (visible.length === 0) {
    return;
  }
  rows.push(repositoryRow(rows, repository, sumLines(repository, scope), null));
  rows.push({ kind: 'branch', key: `${key}:branch`, branch: repository.branch });
  const files: TreeFile[] = [];
  for (const file of visible) {
    const stat: LineStat | null = statOf(file, scope);
    if (stat !== null) {
      files.push({
        path: file.path,
        stat,
        isUncommitted: scope !== 'committed' && file.uncommitted !== null,
      });
    }
  }
  appendTree(rows, `${key}:`, key, files, { checkable: null, scope: null });
}

function appendGitRepository(
  rows: FileRow[],
  repository: RepositoryChanges,
  entry: GitEntryStatus,
  scope: ChangeScope,
  git: GitRowsInput,
): void {
  const { key } = repository;
  const ownFiles: FileChange[] = repository.files.filter(
    (file: FileChange) => file.uncommitted !== null,
  );
  const ownPaths: string[] = ownFiles.map((file: FileChange) => file.path);
  const foreignPaths: string[] = entry.foreign.map((file: GitForeignFile) => file.path);
  const isCollapsed: boolean = git.collapsed[key] ?? false;
  rows.push(
    repositoryRow(rows, repository, sumLines(repository, scope), {
      entry,
      dirtyPaths: [...ownPaths, ...foreignPaths],
      isCollapsed,
      kindLabel: entryKindLabel(repository.key, repository.name),
    }),
  );
  if (isCollapsed) {
    return;
  }
  if (entry.operation !== 'none') {
    rows.push({ kind: 'operation', key: `${key}:operation`, entryKey: key, entry });
  }
  if (scope !== 'committed') {
    rows.push({
      kind: 'commitBox',
      key: `${key}:commitBox`,
      entryKey: key,
      entry,
      ownPaths,
      foreignPaths,
    });
    appendUncommitted(rows, key, ownFiles, entry, git.showForeign[key] ?? false);
  }
  if (scope !== 'uncommitted') {
    appendCommitted(rows, repository, entry, scope);
  }
}

function appendUncommitted(
  rows: FileRow[],
  key: string,
  ownFiles: readonly FileChange[],
  entry: GitEntryStatus,
  isForeignOpen: boolean,
): void {
  rows.push({
    kind: 'group',
    key: `${key}:group:uncommitted`,
    entryKey: key,
    group: 'uncommitted',
    count: ownFiles.length,
    ownPaths: ownFiles.map((file: FileChange) => file.path),
    hasUnpushed: false,
  });
  const own: TreeFile[] = [];
  for (const file of ownFiles) {
    if (file.uncommitted !== null) {
      own.push({ path: file.path, stat: file.uncommitted, isUncommitted: false });
    }
  }
  if (own.length === 0) {
    rows.push({ kind: 'note', key: `${key}:note:uncommitted`, text: NOTHING_OPEN_TEXT });
  }
  appendTree(rows, `${key}:u:`, key, own, { checkable: 'own', scope: 'uncommitted' });
  if (entry.foreign.length === 0) {
    return;
  }
  rows.push({
    kind: 'foreignToggle',
    key: `${key}:foreignToggle`,
    entryKey: key,
    count: entry.foreign.length,
    isOpen: isForeignOpen,
  });
  if (isForeignOpen) {
    const foreign: TreeFile[] = entry.foreign.map((file: GitForeignFile) => ({
      path: file.path,
      stat: foreignLineStat(file),
      isUncommitted: false,
    }));
    appendTree(rows, `${key}:f:`, key, foreign, { checkable: 'foreign', scope: 'uncommitted' });
  }
}

/** Die Zahlen einer fremden Datei in der Form, in der der Dateibaum und der Diff sie lesen. */
export function foreignLineStat(file: GitForeignFile): LineStat {
  return {
    kind: file.kind,
    added: file.added,
    deleted: file.deleted,
    binary: file.binary,
    foreign: false,
  };
}

function appendCommitted(
  rows: FileRow[],
  repository: RepositoryChanges,
  entry: GitEntryStatus,
  scope: ChangeScope,
): void {
  const { key } = repository;
  if (entry.commits.length === 0) {
    // Unter „Alle“ trägt eine leere Gruppe nichts bei; im eigenen Blickwinkel erklärt der Satz die leere Liste.
    if (scope === 'committed') {
      rows.push({ kind: 'note', key: `${key}:note:committed`, text: EMPTY_SCOPE_TEXT.committed });
    }
    return;
  }
  rows.push({
    kind: 'group',
    key: `${key}:group:committed`,
    entryKey: key,
    group: 'committed',
    count: entry.commits.length,
    ownPaths: [],
    hasUnpushed: entry.commits.some((commit: GitOwnCommit) => !commit.pushed),
  });
  for (const commit of entry.commits) {
    rows.push({ kind: 'commit', key: `${key}:commit:${commit.id}`, entryKey: key, commit });
    for (const path of commit.files) {
      const separator: number = path.lastIndexOf('/');
      const file: FileChange | undefined = repository.files.find(
        (candidate: FileChange) => candidate.path === path,
      );
      rows.push({
        kind: 'commitFile',
        key: `${key}:commit:${commit.id}:${path}`,
        entryKey: key,
        path,
        name: path.slice(separator + 1),
        directory: separator < 0 ? '' : path.slice(0, separator),
        change: file?.committed?.kind ?? null,
      });
    }
  }
}

interface TreeFile {
  path: string;
  stat: LineStat;
  isUncommitted: boolean;
}

interface TreeOptions {
  checkable: 'own' | 'foreign' | null;
  scope: ChangeScope | null;
}

/** Ordner- und Dateizeilen. Die Dateien kommen nach Pfad sortiert; ein Ordner steht damit zusammenhängend und
 *  bekommt seine Zeile beim ersten Treffer. `keyPrefix` hält die Schlüssel mehrerer Bäume je Eintrag auseinander. */
function appendTree(
  rows: FileRow[],
  keyPrefix: string,
  entryKey: string,
  files: readonly TreeFile[],
  options: TreeOptions,
): void {
  const seenFolders = new Set<string>();
  for (const file of files) {
    const parts: string[] = file.path.split('/');
    for (let depth = 0; depth < parts.length - 1; depth += 1) {
      const folderPath: string = parts.slice(0, depth + 1).join('/');
      if (!seenFolders.has(folderPath)) {
        seenFolders.add(folderPath);
        rows.push({
          kind: 'folder',
          key: `${keyPrefix}folder:${folderPath}`,
          label: `${parts[depth] ?? ''}/`,
          depth,
        });
      }
    }
    rows.push({
      kind: 'file',
      key: `${keyPrefix}file:${file.path}`,
      entryKey,
      path: file.path,
      label: parts[parts.length - 1] ?? file.path,
      depth: parts.length - 1,
      stat: file.stat,
      isUncommitted: file.isUncommitted,
      checkable: options.checkable,
      scope: options.scope,
    });
  }
}

function repositoryRow(
  rows: readonly FileRow[],
  repository: RepositoryChanges,
  sums: LineSums,
  git: GitRepositoryRow | null,
): FileRow {
  return {
    kind: 'repository',
    key: `${repository.key}:repository`,
    entryKey: repository.key,
    name: repository.name,
    added: sums.added,
    deleted: sums.deleted,
    isFirst: !rows.some((row: FileRow) => row.kind === 'repository'),
    git,
  };
}
