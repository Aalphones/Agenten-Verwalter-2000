import { useEffect, useRef } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { fileCountLabel, formatCount } from '@/features/changes/changesScope';
import type { MergedFile, RepoGroup } from '@/features/files/mergeGroups';
import type { ChangeScope } from '@/lib/bindings/ChangeScope';
import type { FileChange } from '@/lib/bindings/FileChange';
import type { RepositoryChanges } from '@/lib/bindings/RepositoryChanges';
import './FilesOverview.css';

interface FilesOverviewProps {
  groups: readonly RepoGroup[];
  scope: ChangeScope;
  /** `null`: das ganze Vorhaben. */
  filterNumber: number | null;
  /** Commits je Gruppe laut Verlauf; `null`, solange der Verlauf nicht gelesen ist. */
  commitsByGroup: ReadonlyMap<string, number> | null;
  /** Eingehende Commits je Gruppe aus dem Git-Zustand der Session; `null`: kein Git-Zustand, die Spalten „Offen“
   *  und „Abgleich“ entfallen. */
  behindByGroup: ReadonlyMap<string, number> | null;
  /** Der Verlauf unter der Tabelle. */
  history: ReactNode;
  initialTop: number;
  onScrollTop: (top: number) => void;
}

interface Totals {
  files: number;
  created: number;
  modified: number;
  removed: number;
  added: number;
  deleted: number;
}

function totalsOf(groups: readonly RepoGroup[]): Totals {
  const totals: Totals = { files: 0, created: 0, modified: 0, removed: 0, added: 0, deleted: 0 };
  for (const group of groups) {
    totals.added += group.added;
    totals.deleted += group.deleted;
    for (const file of group.files) {
      totals.files += 1;
      countKind(totals, file);
    }
  }
  return totals;
}

function countKind(totals: Totals, file: MergedFile): void {
  switch (file.shown.stat.kind) {
    case 'added':
      totals.created += 1;
      break;
    case 'deleted':
      totals.removed += 1;
      break;
    case 'modified':
      totals.modified += 1;
      break;
  }
}

/** Uncommittete Pfade der Gruppe, unabhängig vom Blickwinkel. */
function openCount(group: RepoGroup): number {
  const paths = new Set<string>();
  for (const entry of group.entries) {
    for (const file of entry.files) {
      if (file.uncommitted !== null) {
        paths.add(file.path);
      }
    }
  }
  return paths.size;
}

function branchesOf(group: RepoGroup): string {
  const branches: string[] = [];
  for (const entry of group.entries) {
    const hasFiles: boolean = entry.files.some((file: FileChange) => file.all !== null);
    if ((entry.isMain || hasFiles) && !branches.includes(entry.branch)) {
      branches.push(entry.branch);
    }
  }
  return branches.join(', ');
}

function commitsLabel(count: number): string {
  return count === 1 ? '1 Commit' : `${formatCount(count)} Commits`;
}

/** Rechte Seite ohne offene Datei: Kennzahlen, Codebasis je Repository, Verlauf. */
export function FilesOverview({
  groups,
  scope,
  filterNumber,
  commitsByGroup,
  behindByGroup,
  history,
  initialTop,
  onScrollTop,
}: FilesOverviewProps): ReactElement {
  const scrollRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<number>(initialTop);
  const onScrollTopRef = useRef(onScrollTop);

  useEffect(() => {
    onScrollTopRef.current = onScrollTop;
  });

  // Bildlauf wie beim letzten Verlassen; beim Verlassen die Stelle merken.
  useEffect(() => {
    const element: HTMLDivElement | null = scrollRef.current;
    if (element !== null) {
      element.scrollTop = topRef.current;
    }
    return (): void => {
      onScrollTopRef.current(topRef.current);
    };
  }, []);

  const totals: Totals = totalsOf(groups);
  let commitTotal: number | null = null;
  if (scope === 'uncommitted') {
    commitTotal = 0;
  } else if (commitsByGroup !== null) {
    commitTotal = 0;
    for (const count of commitsByGroup.values()) {
      commitTotal += count;
    }
  }
  const heading: string =
    filterNumber === null ? 'Ganzes Vorhaben' : `Session #${String(filterNumber)}`;

  function commitsOfGroup(group: string): string {
    if (scope === 'uncommitted') {
      return commitsLabel(0);
    }
    const count: number | undefined = commitsByGroup?.get(group);
    return count === undefined
      ? commitsByGroup === null
        ? '… Commits'
        : commitsLabel(0)
      : commitsLabel(count);
  }

  function renderRow(group: RepoGroup): ReactElement {
    const open: number = openCount(group);
    const behind: number = behindByGroup?.get(group.group) ?? 0;
    const failed: RepositoryChanges | undefined = group.entries.find(
      (entry: RepositoryChanges) => entry.error !== null,
    );
    return (
      <tr key={group.group}>
        <td className="files-overview__repo">{group.name}</td>
        <td className="files-overview__mono" data-label="Codebasis">
          {group.baseRef}
        </td>
        <td data-label="Geändert">
          {fileCountLabel(group.files.length)} · {commitsOfGroup(group.group)}
          {failed !== undefined && (
            <span className="files-overview__error"> · ein Eintrag nicht lesbar</span>
          )}
        </td>
        {behindByGroup !== null && (
          <>
            <td data-label="Offen">
              {open === 0 ? 'alles committed' : `${formatCount(open)} offen`}
            </td>
            <td data-label="Abgleich">
              {behind === 0 ? (
                'synchron'
              ) : (
                <>
                  <span className="files-overview__dot" aria-hidden="true" />
                  {formatCount(behind)} eingehend
                </>
              )}
            </td>
          </>
        )}
        <td className="files-overview__mono files-overview__muted" data-label="Branch">
          {branchesOf(group)}
        </td>
      </tr>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="files-overview"
      onScroll={(event): void => {
        topRef.current = event.currentTarget.scrollTop;
      }}
    >
      <div className="files-overview__page">
        <h2 className="files-overview__heading">{heading} · was sich geändert hat</h2>
        <dl className="files-overview__facts">
          <Fact label="Dateien geändert" value={formatCount(totals.files)} />
          <Fact label="neu" value={formatCount(totals.created)} />
          <Fact label="bearbeitet" value={formatCount(totals.modified)} />
          <Fact label="gelöscht" value={formatCount(totals.removed)} />
          <Fact
            label="Zeilen"
            value={
              <>
                <span className="files-overview__added">+{formatCount(totals.added)}</span>{' '}
                <span className="files-overview__deleted">−{formatCount(totals.deleted)}</span>
              </>
            }
          />
          <Fact label="Commits" value={commitTotal === null ? '…' : formatCount(commitTotal)} />
        </dl>
        <h2 className="files-overview__heading">Codebasis</h2>
        <table className="files-overview__table">
          <thead>
            <tr>
              <th scope="col">Repository</th>
              <th scope="col">Codebasis</th>
              <th scope="col">Geändert</th>
              {behindByGroup !== null && (
                <>
                  <th scope="col">Offen</th>
                  <th scope="col">Abgleich</th>
                </>
              )}
              <th scope="col">Branch</th>
            </tr>
          </thead>
          <tbody>{groups.map(renderRow)}</tbody>
        </table>
        <h2 className="files-overview__heading">Verlauf · wer wann was geändert hat</h2>
        {history}
      </div>
    </div>
  );
}

interface FactProps {
  label: string;
  value: ReactNode;
}

function Fact({ label, value }: FactProps): ReactElement {
  return (
    <div className="files-overview__fact">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
