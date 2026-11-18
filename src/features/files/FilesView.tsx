import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties, KeyboardEvent, ReactElement } from 'react';
import { ResizeHandle } from '@/components/ResizeHandle';
import { formatCount } from '@/features/changes/changesScope';
import {
  ancestorKeys,
  buildTreeRows,
  collapseAllKeys,
  defaultExpanded,
  expandAllKeys,
  expandKey,
} from '@/features/files/buildTreeRows';
import type { TreeRow } from '@/features/files/buildTreeRows';
import { FileSearch } from '@/features/files/FileSearch';
import { FileViewer } from '@/features/files/FileViewer';
import { fileSteps, latestStepOfSession } from '@/features/files/fileSteps';
import { FilesOverview } from '@/features/files/FilesOverview';
import { FilesSegment } from '@/features/files/FilesSegment';
import type { SegmentOption } from '@/features/files/FilesSegment';
import { FilesToolbar } from '@/features/files/FilesToolbar';
import { HistoryList } from '@/features/files/HistoryList';
import { mergeGroups } from '@/features/files/mergeGroups';
import type { RepoGroup } from '@/features/files/mergeGroups';
import { resolvePendingLink } from '@/features/files/openFromLink';
import type { LinkOutcome } from '@/features/files/openFromLink';
import { RepoTree } from '@/features/files/RepoTree';
import type { SearchHit } from '@/features/files/searchFiles';
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
import type { FilesMode, FilesSelection, OpenTarget, PendingLink } from '@/stores/files';
import { useSessionErrorsStore } from '@/stores/sessionErrors';
import { useSessionsStore } from '@/stores/sessions';
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
  /** Eine Session ist neben dem Reiter sichtbar: nur dann gehen Kommentare an Zeilen. */
  canComment: boolean;
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

/** Öffnet eine Datei und klappt ihre Ordner im Baum auf. Eine unveränderte Datei steht nicht in „Geändert“: der
 *  Baum wechselt dann auf „Alle Dateien“. */
function revealUpdate(
  selection: FilesSelection,
  groups: readonly RepoGroup[],
  isChanged: boolean,
  target: OpenTarget,
): Partial<FilesSelection> {
  const nextMode: FilesMode = !isChanged && selection.mode === 'changed' ? 'all' : selection.mode;
  const current: readonly string[] =
    selection.expanded[nextMode] ?? defaultExpanded(groups, nextMode);
  const revealed: string[] = [
    expandKey(target.group, ''),
    ...ancestorKeys(target.group, target.path, Number.POSITIVE_INFINITY),
  ];
  return {
    mode: nextMode,
    expanded: { ...selection.expanded, [nextMode]: [...new Set([...current, ...revealed])] },
    open: target,
    pane: 'detail',
    query: '',
  };
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
  canComment,
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
  const everyAnchors: string[] = groups
    .map((group: RepoGroup) => group.anchorKey)
    .filter((key: string) => key !== '');
  const { trees, ignoredChildren, loadIgnored, loadAll } = useRepoTrees(
    dataSessionId,
    openAnchors,
    everyAnchors,
    stamp,
    selection.pendingLink?.kind === 'name',
  );
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

  /** Mit gesetztem Session-Filter öffnet „Änderung“ mit dem jüngsten Schritt dieser Session. */
  function initialStep(group: string, path: string): string {
    if (sessionFilter === null) {
      return 'all';
    }
    return latestStepOfSession(fileSteps(history, group, path), sessionFilter) ?? 'all';
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
      step: initialStep(row.group, row.path),
      line: null,
    });
  }

  /** Öffnet einen Treffer der Suche, klappt seine Ordner im Baum auf und zeigt dort die Zeile. Eine unveränderte
   *  Datei steht nicht in „Geändert“: der Baum wechselt auf „Alle Dateien“. */
  function openSearchHit(hit: SearchHit): void {
    update(
      revealUpdate(selection, groups, hit.change !== null, {
        group: hit.group,
        entryKey: hit.entryKey,
        path: hit.path,
        view: null,
        step: initialStep(hit.group, hit.path),
        line: null,
      }),
    );
  }

  // Ein Dateilink aus dem Chat wartet, bis Changes (und für einen Namen alle Bäume) geladen sind.
  const pendingLink: PendingLink | null = selection.pendingLink;
  useEffect(() => {
    if (pendingLink === null) {
      return;
    }
    if (sessionFilter !== null) {
      // Schlüssel der Links gelten für das ganze Vorhaben, nicht für eine gefilterte Session.
      updateSelection(viewKey, { sessionFilter: null, expanded: { changed: null, all: null } });
      return;
    }
    if (shownChanges === null && shownError === null) {
      return;
    }
    let outcome: LinkOutcome;
    if (shownChanges === null) {
      outcome = { kind: 'missing', message: shownError ?? '' };
    } else {
      outcome = resolvePendingLink(pendingLink, groups, trees);
    }
    if (outcome.kind === 'wait') {
      return;
    }
    if (outcome.kind === 'missing') {
      updateSelection(viewKey, { pendingLink: null });
      useSessionErrorsStore
        .getState()
        .report(sessionId, `Datei nicht geöffnet: ${outcome.message}`);
      useSessionsStore.getState().showView('chat');
      return;
    }
    if (outcome.kind === 'search') {
      updateSelection(viewKey, {
        pendingLink: null,
        query: outcome.name,
        pane: 'tree',
        focusSearch: selection.focusSearch + 1,
      });
      return;
    }
    updateSelection(viewKey, {
      ...revealUpdate(selection, groups, outcome.group.byPath.has(outcome.path), {
        group: outcome.group.group,
        entryKey: outcome.entryKey,
        path: outcome.path,
        view: outcome.line === null ? null : 'file',
        step: 'all',
        line: outcome.line,
      }),
      pendingLink: null,
    });
  }, [
    pendingLink,
    sessionFilter,
    shownChanges,
    shownError,
    groups,
    trees,
    selection,
    sessionId,
    updateSelection,
    viewKey,
  ]);

  const markSearchFocusHandled = useCallback((): void => {
    updateSelection(viewKey, { focusDone: selection.focusSearch });
  }, [updateSelection, viewKey, selection.focusSearch]);

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

  function revealFolder(group: string, folder: string): void {
    const keys: string[] = [expandKey(group, '')];
    const parts: string[] = folder === '' ? [] : folder.split('/');
    for (let depth = 1; depth <= parts.length; depth += 1) {
      keys.push(expandKey(group, parts.slice(0, depth).join('/')));
    }
    update({
      expanded: { ...selection.expanded, [mode]: [...new Set([...expanded, ...keys])] },
      pane: 'tree',
    });
  }

  function renderOpenFile(open: OpenTarget): ReactElement {
    const group: RepoGroup | undefined = groups.find(
      (candidate: RepoGroup) => candidate.group === open.group,
    );
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
        {group === undefined ? (
          <div className="files-view__hint">
            <b>Repository nicht mehr im Vorhaben</b>
            <span className="files-view__path">{open.path}</span>
          </div>
        ) : (
          <FileViewer
            key={`${open.group}|${open.path}`}
            sessionId={dataSessionId}
            historySessionId={sessionId}
            reach={sessionFilter === null ? 'project' : 'session'}
            group={group}
            open={open}
            history={history}
            scope={scope}
            canComment={canComment}
            onOpen={openTarget}
            onRevealFolder={revealFolder}
            onOverview={showOverview}
          />
        )}
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
        search={
          <FileSearch
            groups={groups}
            trees={trees}
            query={selection.query}
            onQuery={(query: string): void => {
              update({ query });
            }}
            onActivate={loadAll}
            focusRequest={selection.focusSearch}
            focusDone={selection.focusDone}
            onFocusHandled={markSearchFocusHandled}
            onSelect={openSearchHit}
          />
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
