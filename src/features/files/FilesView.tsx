import { useCallback, useMemo, useState } from 'react';
import type { CSSProperties, KeyboardEvent, ReactElement } from 'react';
import { ResizeHandle } from '@/components/ResizeHandle';
import { formatCount } from '@/features/changes/changesScope';
import { DiffView } from '@/features/changes/DiffView';
import { fileDiffKey } from '@/features/changes/useFileDiff';
import {
  buildTreeRows,
  collapseAllKeys,
  defaultExpanded,
  expandAllKeys,
  expandKey,
} from '@/features/files/buildTreeRows';
import type { TreeRow } from '@/features/files/buildTreeRows';
import { FilesOverview } from '@/features/files/FilesOverview';
import { FilesSegment } from '@/features/files/FilesSegment';
import type { SegmentOption } from '@/features/files/FilesSegment';
import { FilesToolbar } from '@/features/files/FilesToolbar';
import { HistoryList } from '@/features/files/HistoryList';
import { mergeGroups, variantEntry } from '@/features/files/mergeGroups';
import type { FileVariant, MergedFile, RepoGroup } from '@/features/files/mergeGroups';
import { RepoTree } from '@/features/files/RepoTree';
import { SessionPicker } from '@/features/files/SessionPicker';
import type { PickerSession } from '@/features/files/SessionPicker';
import { useHistory } from '@/features/files/useHistory';
import { useRepoTrees } from '@/features/files/useRepoTrees';
import type { ChangeScope } from '@/lib/bindings/ChangeScope';
import type { GitEntryStatus } from '@/lib/bindings/GitEntryStatus';
import type { GitSessionStatus } from '@/lib/bindings/GitSessionStatus';
import type { HistoryCommit } from '@/lib/bindings/HistoryCommit';
import type { HistoryFile } from '@/lib/bindings/HistoryFile';
import type { ProjectHistory } from '@/lib/bindings/ProjectHistory';
import type { RepositoryChanges } from '@/lib/bindings/RepositoryChanges';
import type { SessionChanges } from '@/lib/bindings/SessionChanges';
import { usePanelWidth } from '@/lib/usePanelWidth';
import { DEFAULT_FILES_SELECTION, useFilesStore } from '@/stores/files';
import type { FilesMode, FilesSelection, OpenTarget } from '@/stores/files';
import './FilesView.css';

type FileRow = Extract<TreeRow, { kind: 'file' }>;
type IgnoredRow = Extract<TreeRow, { kind: 'ignored' }>;

/** Eine Session des Vorhabens, wie die Oberfläche sie kennt. */
export interface FilesSession {
  id: string;
  number: number;
  name: string;
}

interface FilesViewProps {
  /** Schlüssel der Auswahl im Zustand: je Session, Übersicht des Vorhabens oder Umsetzung. */
  viewKey: string;
  /** Session, über die der Core das Vorhaben liest (Bäume, Verlauf, Diff ohne Filter). */
  sessionId: string;
  /** Changes der Reichweite `project`. */
  projectChanges: SessionChanges | null;
  projectError: string | null;
  /** Changes der gefilterten Session (Reichweite `session`); `null` ohne Filter oder solange sie laden. */
  filteredChanges: SessionChanges | null;
  filteredError: string | null;
  /** Sessions des Vorhabens, aufsteigend nach Nummer. */
  sessions: readonly FilesSession[];
  /** Git-Zustand der Session; `null` in den Übersichten. */
  git: GitSessionStatus | null;
}

const NO_GROUPS: readonly RepoGroup[] = [];

/** Die Stempel der Changes: ändert sich eine Datei, ein Pfad oder ein Eintrag, laden offene Bäume neu. */
function changesStamp(changes: SessionChanges | null): string {
  if (changes === null) {
    return '';
  }
  const parts: string[] = [];
  for (const entry of changes.repositories) {
    parts.push(`${entry.key}#${String(entry.files.length)}`);
    for (const file of entry.files) {
      parts.push(`${file.path}@${String(file.changedAt)}`);
    }
  }
  return parts.join('\n');
}

function commitStampOf(changes: SessionChanges | null): number | null {
  if (changes === null) {
    return null;
  }
  let count = 0;
  for (const entry of changes.repositories) {
    count += entry.commitCount;
  }
  return count;
}

/** Dateien der Commits je Session laut Verlauf (eindeutig je Repository und Pfad). */
function fileCountsOf(history: ProjectHistory | null): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const session of history?.sessions ?? []) {
    const paths = new Set<string>();
    for (const commit of session.commits) {
      for (const file of commit.files) {
        paths.add(`${commit.group}|${file.path}`);
      }
    }
    counts.set(session.sessionId, paths.size);
  }
  return counts;
}

function commitsByGroupOf(
  history: ProjectHistory | null,
  sessionFilter: string | null,
): ReadonlyMap<string, number> | null {
  if (history === null) {
    return null;
  }
  const counts = new Map<string, number>();
  for (const session of history.sessions) {
    if (sessionFilter !== null && session.sessionId !== sessionFilter) {
      continue;
    }
    for (const commit of session.commits) {
      counts.set(commit.group, (counts.get(commit.group) ?? 0) + 1);
    }
  }
  return counts;
}

/** Eingehende Commits je Gruppe; die Einträge des Git-Zustands tragen die Schlüssel der Changes. */
function behindByGroupOf(
  git: GitSessionStatus | null,
  changes: SessionChanges | null,
): ReadonlyMap<string, number> | null {
  if (git === null || changes === null) {
    return null;
  }
  const groupOf = new Map<string, string>(
    changes.repositories.map((entry: RepositoryChanges) => [entry.key, entry.group]),
  );
  const behind = new Map<string, number>();
  for (const entry of git.entries) {
    const group: string | undefined = groupOf.get(entry.key);
    if (group !== undefined) {
      behind.set(group, Math.max(behind.get(group) ?? 0, behindOf(entry)));
    }
  }
  return behind;
}

function behindOf(entry: GitEntryStatus): number {
  return entry.error === null ? entry.behind : 0;
}

function treeWidthStyle(width: number): CSSProperties {
  return { '--files-tree-width': `${String(width)}px` } as CSSProperties;
}

/** Der Reiter „Dateien“: Leiste, links Übersicht-Eintrag und Baum, rechts Übersicht oder offene Datei. */
export function FilesView({
  viewKey,
  sessionId,
  projectChanges,
  projectError,
  filteredChanges,
  filteredError,
  sessions,
  git,
}: FilesViewProps): ReactElement {
  const treeWidth = usePanelWidth('filesTree');
  const selection: FilesSelection = useFilesStore(
    (state) => state.selections[viewKey] ?? DEFAULT_FILES_SELECTION,
  );
  const updateSelection = useFilesStore((state) => state.update);
  const [isPickerOpen, setPickerOpen] = useState<boolean>(false);

  const update = useCallback(
    (change: Partial<FilesSelection>): void => {
      updateSelection(viewKey, change);
    },
    [updateSelection, viewKey],
  );

  // Eine gefilterte Session, die es nicht mehr gibt, hebt den Filter auf.
  const filterSession: FilesSession | undefined =
    selection.sessionFilter === null
      ? undefined
      : sessions.find((session: FilesSession) => session.id === selection.sessionFilter);
  const sessionFilter: string | null = filterSession?.id ?? null;
  const shownChanges: SessionChanges | null =
    sessionFilter === null ? projectChanges : filteredChanges;
  const shownError: string | null = sessionFilter === null ? projectError : filteredError;
  // Schlüssel der Einträge gelten je Session; Bäume und Diffs lesen über die Session der gezeigten Changes.
  const dataSessionId: string = sessionFilter ?? sessionId;
  const { mode, scope } = selection;

  const groups: readonly RepoGroup[] = useMemo(
    () => (shownChanges === null ? NO_GROUPS : mergeGroups(shownChanges, scope)),
    [shownChanges, scope],
  );
  const expanded: ReadonlySet<string> = useMemo(
    () => new Set(selection.expanded[mode] ?? defaultExpanded(groups, mode)),
    [selection.expanded, mode, groups],
  );
  const openAnchors: string[] =
    mode === 'all'
      ? groups
          .filter((group: RepoGroup) => expanded.has(expandKey(group.group, '')))
          .map((group: RepoGroup) => group.anchorKey)
          .filter((key: string) => key !== '')
      : [];
  const stamp: string = useMemo(() => changesStamp(shownChanges), [shownChanges]);
  const { trees, ignoredChildren, loadIgnored } = useRepoTrees(dataSessionId, openAnchors, stamp);
  const { history, error: historyError } = useHistory(sessionId, commitStampOf(projectChanges));

  const rows: TreeRow[] = useMemo(
    () => buildTreeRows({ groups, mode, scope, expanded, trees, ignoredChildren }),
    [groups, mode, scope, expanded, trees, ignoredChildren],
  );
  const commitsByGroup = useMemo(
    () => commitsByGroupOf(history, sessionFilter),
    [history, sessionFilter],
  );
  const behindByGroup = useMemo(() => behindByGroupOf(git, projectChanges), [git, projectChanges]);
  const fileCounts = useMemo(() => fileCountsOf(history), [history]);

  let fileCount = 0;
  let added = 0;
  let deleted = 0;
  for (const group of groups) {
    fileCount += group.files.length;
    added += group.added;
    deleted += group.deleted;
  }
  let commitTotal: number | null = scope === 'uncommitted' ? 0 : null;
  if (commitTotal === null && commitsByGroup !== null) {
    commitTotal = 0;
    for (const count of commitsByGroup.values()) {
      commitTotal += count;
    }
  }
  let treeFileCount: number | null = null;
  for (const group of groups) {
    const tree = trees.get(group.anchorKey);
    if (tree?.status === 'ready') {
      treeFileCount = (treeFileCount ?? 0) + tree.value.files.length;
    }
  }

  function setExpanded(next: readonly string[]): void {
    update({ expanded: { ...selection.expanded, [mode]: next } });
  }

  function toggleExpanded(key: string): void {
    const next = new Set(expanded);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setExpanded([...next]);
  }

  function setFilter(next: string | null): void {
    setPickerOpen(false);
    update({ sessionFilter: next, open: null, expanded: { changed: null, all: null } });
  }

  function openTarget(target: OpenTarget): void {
    update({ open: target, pane: 'detail' });
  }

  function openTreeFile(row: FileRow): void {
    const group: RepoGroup | undefined = groups.find(
      (candidate: RepoGroup) => candidate.group === row.group,
    );
    openTarget({
      group: row.group,
      entryKey: row.file?.shown.entryKey ?? group?.anchorKey ?? '',
      path: row.path,
      view: null,
      step: 'all',
      line: null,
    });
  }

  function toggleIgnored(row: IgnoredRow): void {
    const key: string = expandKey(row.group, row.path);
    if (!expanded.has(key)) {
      loadIgnored(row.entryKey, row.path);
    }
    toggleExpanded(key);
  }

  function openHistoryFile(commit: HistoryCommit, file: HistoryFile): void {
    openTarget({
      group: commit.group,
      entryKey: commit.key,
      path: file.path,
      view: 'diff',
      step: commit.id,
      line: null,
    });
  }

  function toggleCommit(key: string): void {
    const isOpen: boolean = selection.openCommits.includes(key);
    update({
      openCommits: isOpen
        ? selection.openCommits.filter((candidate: string) => candidate !== key)
        : [...selection.openCommits, key],
    });
  }

  function showOverview(): void {
    update({ open: null, page: 'overview', pane: 'detail' });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'Escape' && !event.defaultPrevented && selection.open !== null) {
      event.preventDefault();
      update({ open: null });
    }
  }

  const pickerSessions: PickerSession[] = [...sessions]
    .reverse()
    .map((session: FilesSession): PickerSession => ({
      ...session,
      fileCount: history === null ? null : (fileCounts.get(session.id) ?? 0),
    }));
  const modeOptions: readonly SegmentOption<FilesMode>[] = [
    {
      value: 'changed',
      label: (
        <>
          Geändert <span className="files-segment__count">{formatCount(fileCount)}</span>
        </>
      ),
      title: 'Nur geänderte Dateien',
    },
    {
      value: 'all',
      label: (
        <>
          Alle Dateien
          {treeFileCount !== null && (
            <span className="files-segment__count">
              {formatCount(Math.max(treeFileCount, fileCount))}
            </span>
          )}
        </>
      ),
      title: 'Alle Dateien des Repositorys, ignorierte grau',
    },
  ];
  const expandTitle: string =
    mode === 'all' ? 'Ordner mit Änderungen aufklappen' : 'Alle Ordner aufklappen';

  function renderTree(): ReactElement {
    if (shownChanges === null) {
      return (
        <p className={shownError === null ? 'files-view__notice' : 'files-view__error'}>
          {shownError ?? 'Dateien werden gelesen …'}
        </p>
      );
    }
    return (
      <RepoTree
        rows={rows}
        mode={mode}
        selected={
          selection.open === null
            ? null
            : { group: selection.open.group, path: selection.open.path }
        }
        onToggle={(group: string, path: string): void => {
          toggleExpanded(expandKey(group, path));
        }}
        onToggleIgnored={toggleIgnored}
        onOpenFile={openTreeFile}
      />
    );
  }

  function renderBar(): ReactElement {
    return (
      <div className="files-view__bar">
        <button
          type="button"
          className="files-button files-button--small files-view__narrow-only"
          onClick={(): void => {
            update({ pane: 'tree' });
          }}
        >
          ← Baum
        </button>
        {selection.open !== null && (
          <button
            type="button"
            className="files-button files-button--small"
            title="Zurück zur Übersicht mit Verlauf (Esc)"
            onClick={showOverview}
          >
            ← Übersicht
          </button>
        )}
      </div>
    );
  }

  function renderOpenFile(open: OpenTarget): ReactElement {
    const group: RepoGroup | undefined = groups.find(
      (candidate: RepoGroup) => candidate.group === open.group,
    );
    const merged: MergedFile | undefined = group?.byPath.get(open.path);
    const variant: FileVariant | undefined =
      merged?.variants.find((candidate: FileVariant) => candidate.entryKey === open.entryKey) ??
      merged?.shown;
    const repository: RepositoryChanges | undefined =
      group === undefined || variant === undefined ? undefined : variantEntry(group, variant);
    if (repository === undefined || variant === undefined) {
      return (
        <>
          {renderBar()}
          <div className="files-view__hint">
            <b>Ganze Datei folgt</b>
            <span className="files-view__path">{open.path}</span>
            <span>
              Die Datei ist im gewählten Blickwinkel unverändert; ihren Inhalt zeigt die Ansicht
              bald.
            </span>
          </div>
        </>
      );
    }
    return (
      <>
        {renderBar()}
        <DiffView
          key={fileDiffKey({ key: repository.key, path: variant.change.path }, scope)}
          sessionId={dataSessionId}
          reach={sessionFilter === null ? 'project' : 'session'}
          repository={repository}
          file={variant.change}
          scope={scope}
          onClose={(): void => {
            update({ open: null });
          }}
        />
      </>
    );
  }

  function renderDetail(): ReactElement {
    if (selection.open !== null) {
      return renderOpenFile(selection.open);
    }
    if (shownChanges === null) {
      return (
        <p className={shownError === null ? 'files-view__notice' : 'files-view__error'}>
          {shownError ?? 'Dateien werden gelesen …'}
        </p>
      );
    }
    return (
      <>
        <div className="files-view__narrow-only files-view__bar files-view__bar--plain">
          <button
            type="button"
            className="files-button files-button--small"
            onClick={(): void => {
              update({ pane: 'tree' });
            }}
          >
            ← Baum
          </button>
        </div>
        <FilesOverview
          key={sessionFilter ?? 'all'}
          groups={groups}
          scope={scope}
          filterNumber={filterSession?.number ?? null}
          commitsByGroup={commitsByGroup}
          behindByGroup={behindByGroup}
          initialTop={selection.overviewTop}
          onScrollTop={(top: number): void => {
            update({ overviewTop: top });
          }}
          history={
            <HistoryList
              history={history}
              error={historyError}
              sessionFilter={sessionFilter}
              scope={scope}
              isMultiGroup={groups.length > 1}
              openCommits={selection.openCommits}
              onToggleCommit={toggleCommit}
              onFilterSession={setFilter}
              onOpenFile={openHistoryFile}
            />
          }
        />
      </>
    );
  }

  const isHome: boolean = selection.open === null;
  return (
    <div className="files-view" onKeyDown={handleKeyDown}>
      <FilesToolbar
        filterNumber={filterSession?.number ?? null}
        isPickerOpen={isPickerOpen}
        picker={
          isPickerOpen && (
            <SessionPicker
              sessions={pickerSessions}
              selectedId={sessionFilter}
              onSelect={setFilter}
              onClose={(): void => {
                setPickerOpen(false);
              }}
            />
          )
        }
        onTogglePicker={(): void => {
          setPickerOpen(!isPickerOpen);
        }}
        onClearFilter={(): void => {
          setFilter(null);
        }}
        scope={scope}
        onScope={(next: ChangeScope): void => {
          update({ scope: next });
        }}
        fileCount={fileCount}
        added={added}
        deleted={deleted}
      />
      <div className="files-view__body" data-pane={selection.pane}>
        <div className="files-view__left" style={treeWidthStyle(treeWidth.width)}>
          <button
            type="button"
            className={`files-view__home${isHome ? ' files-view__home--on' : ''}`}
            aria-current={isHome ? 'page' : undefined}
            onClick={showOverview}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
              <path
                d="M7 4v3.2l2 1.3"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>
            <span className="files-view__home-label">Übersicht · Verlauf</span>
            <span className="files-view__home-count">
              {commitTotal === null ? '… Commits' : `${formatCount(commitTotal)} Commits`}
            </span>
          </button>
          <div className="files-view__left-head">
            <FilesSegment
              label="Umfang des Baums"
              options={modeOptions}
              value={mode}
              onChange={(next: FilesMode): void => {
                update({ mode: next });
              }}
            />
            <span className="files-view__spacer" />
            <button
              type="button"
              className="files-button files-button--small files-button--quiet"
              title={expandTitle}
              aria-label={expandTitle}
              onClick={(): void => {
                setExpanded(expandAllKeys(groups));
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <path
                  d="M4 5.5l3-3 3 3M4 8.5l3 3 3-3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              type="button"
              className="files-button files-button--small files-button--quiet"
              title="Alle Ordner einklappen"
              aria-label="Alle Ordner einklappen"
              onClick={(): void => {
                setExpanded(collapseAllKeys(groups));
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <path
                  d="M4 2.5l3 3 3-3M4 11.5l3-3 3 3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
          {renderTree()}
        </div>
        <ResizeHandle edge="end" label="Breite der Dateiliste" {...treeWidth.handleProps} />
        <div className="files-view__detail" data-resize-fill>
          {renderDetail()}
        </div>
      </div>
    </div>
  );
}
