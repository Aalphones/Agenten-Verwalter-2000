import type { ChangeScope } from '@/lib/bindings/ChangeScope';
import type { FileChange } from '@/lib/bindings/FileChange';
import type { LineStat } from '@/lib/bindings/LineStat';
import type { RepositoryChanges } from '@/lib/bindings/RepositoryChanges';
import type { SessionChanges } from '@/lib/bindings/SessionChanges';

export const NUMBER_FORMAT = new Intl.NumberFormat('de-DE');

export const EMPTY_SCOPE_TEXT: Record<ChangeScope, string> = {
  all: 'Noch keine Änderungen gegen die Basis.',
  uncommitted: 'Keine uncommitted Änderungen.',
  committed: 'Noch nichts committed.',
};

export interface LineSums {
  added: number;
  deleted: number;
}

export function statOf(file: FileChange, scope: ChangeScope): LineStat | null {
  return file[scope];
}

/** Dateien, die unter „Alle“ geändert sind, über alle Repositories. */
export function countChangedFiles(changes: SessionChanges): number {
  let total = 0;
  for (const repository of changes.repositories) {
    total += countFilesInScope(repository, 'all');
  }
  return total;
}

export function countFilesInScope(repository: RepositoryChanges, scope: ChangeScope): number {
  return repository.files.filter((file: FileChange) => statOf(file, scope) !== null).length;
}

/** Summe der Zeilen der Dateien im Blickwinkel; Binärdateien tragen 0 bei. */
export function sumLines(repository: RepositoryChanges, scope: ChangeScope): LineSums {
  const sums: LineSums = { added: 0, deleted: 0 };
  for (const file of repository.files) {
    const stat: LineStat | null = statOf(file, scope);
    if (stat !== null) {
      sums.added += stat.added;
      sums.deleted += stat.deleted;
    }
  }
  return sums;
}

export function formatCount(value: number): string {
  return NUMBER_FORMAT.format(value);
}

export function fileCountLabel(count: number): string {
  return count === 1 ? '1 Datei' : `${formatCount(count)} Dateien`;
}
