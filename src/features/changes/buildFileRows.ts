import { statOf, sumLines, type LineSums } from '@/features/changes/changesScope';
import type { ChangeScope } from '@/lib/bindings/ChangeScope';
import type { FileChange } from '@/lib/bindings/FileChange';
import type { LineStat } from '@/lib/bindings/LineStat';
import type { RepositoryChanges } from '@/lib/bindings/RepositoryChanges';
import type { SessionChanges } from '@/lib/bindings/SessionChanges';

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
    };

/** Die Zeilen des Dateibaums: je Repository Kopf, Branch und der Baum der Dateien im Blickwinkel. */
export function buildFileRows(
  changes: SessionChanges,
  repositoryFilter: string | null,
  scope: ChangeScope,
): FileRow[] {
  const rows: FileRow[] = [];
  for (const repository of changes.repositories) {
    if (repositoryFilter !== null && repository.key !== repositoryFilter) {
      continue;
    }
    appendRepository(rows, repository, scope);
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
    rows.push(repositoryRow(rows, repository, { added: 0, deleted: 0 }));
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
  rows.push(repositoryRow(rows, repository, sumLines(repository, scope)));
  rows.push({ kind: 'branch', key: `${key}:branch`, branch: repository.branch });
  // Der Core liefert die Dateien nach Pfad sortiert; ein Ordner steht damit zusammenhängend und
  // bekommt seine Zeile beim ersten Treffer.
  const seenFolders = new Set<string>();
  for (const file of visible) {
    const stat: LineStat | null = statOf(file, scope);
    if (stat === null) {
      continue;
    }
    const parts: string[] = file.path.split('/');
    for (let depth = 0; depth < parts.length - 1; depth += 1) {
      const folderPath: string = parts.slice(0, depth + 1).join('/');
      if (!seenFolders.has(folderPath)) {
        seenFolders.add(folderPath);
        rows.push({
          kind: 'folder',
          key: `${key}:folder:${folderPath}`,
          label: `${parts[depth] ?? ''}/`,
          depth,
        });
      }
    }
    rows.push({
      kind: 'file',
      key: `${key}:file:${file.path}`,
      entryKey: key,
      path: file.path,
      label: parts[parts.length - 1] ?? file.path,
      depth: parts.length - 1,
      stat,
      isUncommitted: scope !== 'committed' && file.uncommitted !== null,
    });
  }
}

function repositoryRow(
  rows: readonly FileRow[],
  repository: RepositoryChanges,
  sums: LineSums,
): FileRow {
  return {
    kind: 'repository',
    key: `${repository.key}:repository`,
    entryKey: repository.key,
    name: repository.name,
    added: sums.added,
    deleted: sums.deleted,
    isFirst: !rows.some((row: FileRow) => row.kind === 'repository'),
  };
}
