import type { ReactElement } from 'react';
import { branchLabel } from '@/features/git/gitTexts';
import { BranchIcon } from '@/features/git/GitIcons';
import type { GitEntryStatus } from '@/lib/bindings/GitEntryStatus';
import type { GitSessionStatus } from '@/lib/bindings/GitSessionStatus';
import type { RepositoryChanges } from '@/lib/bindings/RepositoryChanges';
import type { SessionChanges } from '@/lib/bindings/SessionChanges';
import './GitBranchPill.css';

const CLICK_HINT = 'Klick: Changes öffnen';

interface GitBranchPillProps {
  status: GitSessionStatus | null;
  /** Für Namen der Einträge und die eigenen uncommitteten Dateien; fehlt, solange nicht gelesen. */
  changes: SessionChanges | null;
  onOpenChanges: () => void;
}

function repositoryOf(
  changes: SessionChanges | null,
  entry: GitEntryStatus,
): RepositoryChanges | undefined {
  return changes?.repositories.find((candidate: RepositoryChanges) => candidate.key === entry.key);
}

/** Uncommittet sind die eigenen Dateien der Session (`FileChange.uncommitted`) und die fremden im Ordner. */
function isDirty(changes: SessionChanges | null, entry: GitEntryStatus): boolean {
  const ownFiles = repositoryOf(changes, entry)?.files ?? [];
  return entry.foreign.length > 0 || ownFiles.some((file) => file.uncommitted !== null);
}

/** `↓n` und `↑m`, nur was ungleich 0 ist. */
function syncParts(entry: GitEntryStatus): string[] {
  const parts: string[] = [];
  if (entry.behind > 0) {
    parts.push(`↓${String(entry.behind)}`);
  }
  if (entry.ahead > 0) {
    parts.push(`↑${String(entry.ahead)}`);
  }
  return parts;
}

function syncText(entry: GitEntryStatus): string {
  return syncParts(entry).join('');
}

/** Ein Eintrag, dessen Git-Zustand nicht lesbar ist, hat keinen Branch — „losgelöst“ wäre dafür falsch. */
function branchText(entry: GitEntryStatus): string {
  return entry.error === null ? branchLabel(entry.branch) : 'nicht lesbar';
}

function tooltipLine(changes: SessionChanges | null, entry: GitEntryStatus): string {
  const name: string = repositoryOf(changes, entry)?.name ?? entry.key;
  return [`${name}: ${branchText(entry)}`, ...syncParts(entry)].join(' ');
}

/** Die Branch-Pille in der Kopfzeile: Branch des ersten Eintrags, Abstand zum Remote, ein Punkt bei offenen
 *  Änderungen und `+N` bei weiteren Einträgen mit Git. Ein Klick öffnet die Changes. */
export function GitBranchPill({
  status,
  changes,
  onOpenChanges,
}: GitBranchPillProps): ReactElement | null {
  const first: GitEntryStatus | undefined = status?.entries[0];
  if (status === null || first === undefined) {
    return null;
  }
  const more: number = status.entries.length - 1;
  const sync: string = syncText(first);
  const title: string = [
    ...status.entries.map((entry: GitEntryStatus) => tooltipLine(changes, entry)),
    CLICK_HINT,
  ].join('\n');

  return (
    <button type="button" className="git-branch-pill" title={title} onClick={onOpenChanges}>
      <BranchIcon />
      <span className="git-branch-pill__branch">{branchText(first)}</span>
      {sync !== '' && <span className="git-branch-pill__sync">{sync}</span>}
      {isDirty(changes, first) && (
        <span className="git-branch-pill__dirty" role="img" aria-label="Uncommittete Änderungen" />
      )}
      {more > 0 && <span className="git-branch-pill__more">+{String(more)}</span>}
    </button>
  );
}
