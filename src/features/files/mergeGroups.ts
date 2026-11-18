import { statOf } from '@/features/changes/changesScope';
import type { ChangeScope } from '@/lib/bindings/ChangeScope';
import type { FileChange } from '@/lib/bindings/FileChange';
import type { LineStat } from '@/lib/bindings/LineStat';
import type { RepositoryChanges } from '@/lib/bindings/RepositoryChanges';
import type { SessionChanges } from '@/lib/bindings/SessionChanges';

/** Höchstens so viele Branches stehen am Knoten, danach `+n`. */
const MAX_BRANCHES_SHOWN = 2;

/** Eine Fassung einer Datei: aus einem Eintrag (Haupt-Checkout oder Ticket-Worktree) des Repositorys. */
export interface FileVariant {
  entryKey: string;
  branch: string;
  change: FileChange;
  /** Zahlen im gewählten Blickwinkel. */
  stat: LineStat;
}

export interface MergedFile {
  path: string;
  /** Nach `changedAt` absteigend; die erste ist die gezeigte. */
  variants: readonly FileVariant[];
  shown: FileVariant;
}

export interface EntryError {
  entryKey: string;
  message: string;
}

/** Ein Repository-Knoten: alle Einträge desselben Repositorys zusammen (README → „Zusammenlegen der Einträge“). */
export interface RepoGroup {
  group: string;
  name: string;
  entries: readonly RepositoryChanges[];
  /** Nach Pfad sortiert (Byte-Reihenfolge wie aus dem Core). */
  files: readonly MergedFile[];
  byPath: ReadonlyMap<string, MergedFile>;
  /** Eintrag, dessen Ordner den Baum „Alle Dateien“ liefert. */
  anchorKey: string;
  baseRef: string;
  /** Nebenangabe am Knoten, z. B. `feature/x, feature/y +1`; leer, wenn nichts von der Codebasis abweicht. */
  branchLabel: string;
  added: number;
  deleted: number;
  errors: readonly EntryError[];
}

function entryOf(
  entries: readonly RepositoryChanges[],
  key: string,
): RepositoryChanges | undefined {
  return entries.find((entry: RepositoryChanges) => entry.key === key);
}

/** Zwei Fassungen mit gleichem, gesetztem letzten Commit und ohne uncommittete Änderung sind dieselbe. */
function sameCommitted(first: FileVariant, second: FileVariant): boolean {
  return (
    first.change.lastCommit !== null &&
    first.change.lastCommit === second.change.lastCommit &&
    first.change.uncommitted === null &&
    second.change.uncommitted === null
  );
}

function addVariant(
  variants: FileVariant[],
  candidate: FileVariant,
  entries: readonly RepositoryChanges[],
): void {
  const twinIndex: number = variants.findIndex((variant: FileVariant) =>
    sameCommitted(variant, candidate),
  );
  if (twinIndex < 0) {
    variants.push(candidate);
    return;
  }
  // Es bleibt die Fassung des Haupt-Checkouts, sonst die erste.
  const isCandidateMain: boolean = entryOf(entries, candidate.entryKey)?.isMain ?? false;
  if (isCandidateMain) {
    variants[twinIndex] = candidate;
  }
}

function latestChange(entry: RepositoryChanges): number {
  let latest = -1;
  for (const file of entry.files) {
    latest = Math.max(latest, file.changedAt);
  }
  return latest;
}

function chooseAnchor(entries: readonly RepositoryChanges[]): RepositoryChanges | undefined {
  let anchor: RepositoryChanges | undefined;
  let anchorTime = -1;
  for (const entry of entries) {
    const time: number = entry.files.length === 0 ? -1 : latestChange(entry);
    if (time > anchorTime) {
      anchor = entry;
      anchorTime = time;
    }
  }
  return (
    anchor ??
    entries.find((entry: RepositoryChanges) => entry.isMain && entry.error === null) ??
    entries.find((entry: RepositoryChanges) => entry.isMain) ??
    entries[0]
  );
}

function branchLabelOf(
  entries: readonly RepositoryChanges[],
  scope: ChangeScope,
  baseRef: string,
): string {
  const branches: string[] = [];
  for (const entry of entries) {
    const hasFiles: boolean = entry.files.some((file: FileChange) => statOf(file, scope) !== null);
    if (hasFiles && entry.branch !== baseRef && !branches.includes(entry.branch)) {
      branches.push(entry.branch);
    }
  }
  const shown: string = branches.slice(0, MAX_BRANCHES_SHOWN).join(', ');
  const rest: number = branches.length - MAX_BRANCHES_SHOWN;
  return rest > 0 ? `${shown} +${String(rest)}` : shown;
}

function compareBytes(first: string, second: string): number {
  if (first === second) {
    return 0;
  }
  return first < second ? -1 : 1;
}

function buildGroup(
  group: string,
  entries: readonly RepositoryChanges[],
  scope: ChangeScope,
): RepoGroup {
  const variantsByPath = new Map<string, FileVariant[]>();
  const errors: EntryError[] = [];
  for (const entry of entries) {
    if (entry.error !== null) {
      errors.push({ entryKey: entry.key, message: entry.error });
    }
    for (const change of entry.files) {
      const stat: LineStat | null = statOf(change, scope);
      if (stat === null) {
        continue;
      }
      const variants: FileVariant[] = variantsByPath.get(change.path) ?? [];
      addVariant(variants, { entryKey: entry.key, branch: entry.branch, change, stat }, entries);
      variantsByPath.set(change.path, variants);
    }
  }

  const files: MergedFile[] = [];
  let added = 0;
  let deleted = 0;
  for (const [path, variants] of variantsByPath) {
    variants.sort(
      (first: FileVariant, second: FileVariant) => second.change.changedAt - first.change.changedAt,
    );
    const shown: FileVariant | undefined = variants[0];
    if (shown === undefined) {
      continue;
    }
    files.push({ path, variants, shown });
    added += shown.stat.added;
    deleted += shown.stat.deleted;
  }
  files.sort((first: MergedFile, second: MergedFile) => compareBytes(first.path, second.path));

  const main: RepositoryChanges | undefined =
    entries.find((entry: RepositoryChanges) => entry.isMain) ?? entries[0];
  const baseRef: string = main?.baseRef ?? '';
  const first: RepositoryChanges | undefined = entries[0];
  return {
    group,
    name: first?.groupName ?? group,
    entries,
    files,
    byPath: new Map(files.map((file: MergedFile) => [file.path, file])),
    anchorKey: chooseAnchor(entries)?.key ?? '',
    baseRef,
    branchLabel: branchLabelOf(entries, scope, baseRef),
    added,
    deleted,
    errors,
  };
}

/** Legt die Einträge der Changes zu Repository-Knoten zusammen, in der Reihenfolge des ersten Auftretens. */
export function mergeGroups(changes: SessionChanges, scope: ChangeScope): RepoGroup[] {
  const entriesByGroup = new Map<string, RepositoryChanges[]>();
  for (const entry of changes.repositories) {
    const entries: RepositoryChanges[] = entriesByGroup.get(entry.group) ?? [];
    entries.push(entry);
    entriesByGroup.set(entry.group, entries);
  }
  return [...entriesByGroup].map(([group, entries]: [string, RepositoryChanges[]]) =>
    buildGroup(group, entries, scope),
  );
}

/** Der Eintrag, aus dem eine Fassung stammt. */
export function variantEntry(
  group: RepoGroup,
  variant: FileVariant,
): RepositoryChanges | undefined {
  return entryOf(group.entries, variant.entryKey);
}
