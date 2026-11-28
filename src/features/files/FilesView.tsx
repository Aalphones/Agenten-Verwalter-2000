import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, ReactElement } from 'react';
import { ResizeHandle } from '@/components/ResizeHandle';
import { formatCount } from '@/features/changes/changesScope';
import {
  buildSessionRows,
  defaultSessionExpanded,
  sessionGroupKeys,
  sessionRevealKeys,
} from '@/features/files/buildSessionRows';
import type { SessionRow } from '@/features/files/buildSessionRows';
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
import { GitPage } from '@/features/files/GitPage';
import { HistoryList } from '@/features/files/HistoryList';
import { mergeGroups } from '@/features/files/mergeGroups';
import type { RepoGroup } from '@/features/files/mergeGroups';
import { findSessionFile, resolvePendingLink } from '@/features/files/openFromLink';
import type { LinkOutcome, SessionFileMatch } from '@/features/files/openFromLink';
import { RepoTree } from '@/features/files/RepoTree';
import type { SearchHit } from '@/features/files/searchFiles';
import { SessionPicker } from '@/features/files/SessionPicker';
import type { PickerSession } from '@/features/files/SessionPicker';
import { SessionFileViewer } from '@/features/files/SessionFileViewer';
import { useHistory } from '@/features/files/useHistory';
import { useRepoTrees } from '@/features/files/useRepoTrees';
import { useSessionFiles } from '@/features/files/useSessionFiles';
import type { ChangeScope } from '@/lib/bindings/ChangeScope';
import type { GitEntryStatus } from '@/lib/bindings/GitEntryStatus';
import type { GitSessionStatus } from '@/lib/bindings/GitSessionStatus';
import type { HistoryCommit } from '@/lib/bindings/HistoryCommit';
import type { HistoryFile } from '@/lib/bindings/HistoryFile';
import type { ProjectHistory } from '@/lib/bindings/ProjectHistory';
import type { RepositoryChanges } from '@/lib/bindings/RepositoryChanges';
import type { SessionChanges } from '@/lib/bindings/SessionChanges';
import type { SessionFile } from '@/lib/bindings/SessionFile';
import type { SessionFileGroup } from '@/lib/bindings/SessionFileGroup';
import type { SessionFilesListing } from '@/lib/bindings/SessionFilesListing';
import { usePanelWidth } from '@/lib/usePanelWidth';
import {
  DEFAULT_FILES_SELECTION,
  previewKeyOf,
  SESSION_FILES_GROUP,
  useFilesStore,
} from '@/stores/files';
import type { FilesMode, FilesPage, FilesSelection, OpenTarget, PendingLink } from '@/stores/files';
import { useSessionErrorsStore } from '@/stores/sessionErrors';
import { useSessionsStore } from '@/stores/sessions';
import './FilesView.css';

type FileRow = Extract<TreeRow, { kind: 'file' }>;
type IgnoredRow = Extract<TreeRow, { kind: 'ignored' }>;
type SessionLink = Extract<PendingLink, { kind: 'session' }>;

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
  /** Ohne Repository ist die Ansicht schlank: keine Git-Teile, nur Session-Dateien und Betrachter. */
  hasRepositories: boolean;
  /** Ändert er sich, lädt die Liste der Session-Dateien neu — ohne Repository wechselt der Stempel der
   *  Changes nie. */
  activityStamp: string;
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
  /** Changes der Reichweite `session` für die Git-Seite; `null` in den Übersichten und solange sie laden. */
  sessionChanges: SessionChanges | null;
  /** Lädt nach einer Git-Aktion Git-Zustand und Changes neu. */
  onChanged: () => void;
  /** Eine Session ist neben dem Reiter sichtbar: nur dann gehen Kommentare an Zeilen. */
  canComment: boolean;
}

const NO_GROUPS: readonly RepoGroup[] = [];
const NO_FOLDERS: readonly string[] = [];

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

function sessionFileTarget(match: SessionFileMatch, line: number | null): OpenTarget {
  return {
    source: 'session',
    group: SESSION_FILES_GROUP,
    entryKey: '',
    path: match.file.path,
    view: 'file',
    step: 'all',
    line,
    ownerId: match.group.sessionId,
  };
}

function treeWidthStyle(width: number): CSSProperties {
  return { '--files-tree-width': `${String(width)}px` } as CSSProperties;
}

/** Der Reiter „Dateien“: Leiste, links Übersicht-Eintrag und Baum, rechts Übersicht oder offene Datei. */
export function FilesView({
  viewKey,
  sessionId,
  hasRepositories,
  activityStamp,
  projectChanges,
  projectError,
  filteredChanges,
  filteredError,
  sessions,
  git,
  sessionChanges,
  onChanged,
  canComment,
}: FilesViewProps): ReactElement {
  const treeWidth = usePanelWidth('filesTree');
  const selection: FilesSelection = useFilesStore(
    (state) => state.selections[viewKey] ?? DEFAULT_FILES_SELECTION,
  );
  const updateSelection = useFilesStore((state) => state.update);
  const [isPickerOpen, setPickerOpen] = useState<boolean>(false);
  /** Der Link, für den die Liste schon einmal neu gelesen wurde. */
  const retriedLinkRef = useRef<SessionLink | null>(null);
  const unmountRef = useRef<AbortController | null>(null);

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
  // Die Liste gilt dem ganzen Vorhaben; der Filter wählt nur die Gruppe und liest nichts neu.
  const {
    listing: sessionListing,
    error: sessionListError,
    isLoading: isSessionListLoading,
    reload: reloadSessionFiles,
  } = useSessionFiles(sessionId, `${stamp}|${activityStamp}`);
  const ownSessionId: string | null = canComment ? sessionId : null;
  const sessionExpanded: ReadonlySet<string> = useMemo(
    () => new Set(selection.sessionExpanded ?? defaultSessionExpanded(ownSessionId)),
    [selection.sessionExpanded, ownSessionId],
  );

  const repoRows: TreeRow[] = useMemo(
    () => buildTreeRows({ groups, mode, scope, expanded, trees, ignoredChildren }),
    [groups, mode, scope, expanded, trees, ignoredChildren],
  );
  const sessionRows: SessionRow[] = useMemo(
    () =>
      buildSessionRows({
        listing: sessionListing,
        error: sessionListError,
        isLoading: isSessionListLoading,
        filter: sessionFilter,
        expanded: sessionExpanded,
        ownSessionId,
      }),
    [
      sessionListing,
      sessionListError,
      isSessionListLoading,
      sessionFilter,
      sessionExpanded,
      ownSessionId,
    ],
  );
  const rows: TreeRow[] = useMemo(
    () => [
      ...repoRows,
      ...sessionRows.map((row: SessionRow): TreeRow => ({ kind: 'session', key: row.key, row })),
    ],
    [repoRows, sessionRows],
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
    // Wer nach einer Session filtert, will ihre Dateien sehen: ihre Gruppe geht mit auf.
    const nextSessionExpanded: readonly string[] | null =
      next === null
        ? selection.sessionExpanded
        : [...new Set([...sessionExpanded, ...sessionGroupKeys(next)])];
    update({
      sessionFilter: next,
      open: null,
      expanded: { changed: null, all: null },
      sessionExpanded: nextSessionExpanded,
    });
  }

  function toggleSession(key: string): void {
    const next = new Set(sessionExpanded);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    update({ sessionExpanded: [...next] });
  }

  function openSessionFile(file: SessionFile, group: SessionFileGroup): void {
    openTarget(sessionFileTarget({ file, group }, null));
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
      source: 'repo',
      ownerId: null,
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
        source: 'repo',
        ownerId: null,
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
    // Session-Dateien brauchen keine Changes; sie löst der Effekt darunter auf.
    if (pendingLink.kind === 'session' || (shownChanges === null && shownError === null)) {
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
        source: 'repo',
        ownerId: null,
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

  // Ein Link auf eine Session-Datei wartet auf die Liste. Fehlt die Datei darin (die Liste ist älter als der Klick),
  // wird sie einmal neu gelesen.
  useEffect(() => {
    const controller = new AbortController();
    unmountRef.current = controller;
    return (): void => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (pendingLink?.kind !== 'session' || sessionFilter !== null || isSessionListLoading) {
      return;
    }
    const link: SessionLink = pendingLink;
    const unmount: AbortSignal | undefined = unmountRef.current?.signal;
    function isStillPending(): boolean {
      return useFilesStore.getState().selections[viewKey]?.pendingLink === link;
    }
    function openMatch(match: SessionFileMatch): void {
      const current: FilesSelection =
        useFilesStore.getState().selections[viewKey] ?? DEFAULT_FILES_SELECTION;
      const open: readonly string[] =
        current.sessionExpanded ?? defaultSessionExpanded(ownSessionId);
      const revealed: string[] = sessionRevealKeys(match.group.sessionId, match.file);
      updateSelection(viewKey, {
        sessionExpanded: [...new Set([...open, ...revealed])],
        open: sessionFileTarget(match, link.line),
        pane: 'detail',
        query: '',
        pendingLink: null,
      });
    }
    function matchIn(listing: SessionFilesListing | null): SessionFileMatch | null {
      return listing === null ? null : findSessionFile(listing, link.real, link.path);
    }

    const match: SessionFileMatch | null = matchIn(sessionListing);
    if (match !== null) {
      openMatch(match);
      return;
    }
    if (retriedLinkRef.current === link) {
      return;
    }
    retriedLinkRef.current = link;
    void reloadSessionFiles().then((fresh: SessionFilesListing | null) => {
      // Nach dem Verlassen der Ansicht bleibt der Link liegen und wird beim nächsten Öffnen aufgelöst.
      if (unmount?.aborted === true || !isStillPending()) {
        return;
      }
      const found: SessionFileMatch | null = matchIn(fresh);
      if (found !== null) {
        openMatch(found);
        return;
      }
      updateSelection(viewKey, { pendingLink: null });
      useSessionErrorsStore.getState().report(sessionId, `Datei nicht gefunden: ${link.path}`);
      useSessionsStore.getState().showView('chat');
    });
  }, [
    pendingLink,
    sessionFilter,
    sessionListing,
    isSessionListLoading,
    reloadSessionFiles,
    ownSessionId,
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
      source: 'repo',
      ownerId: null,
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

  function showGitPage(group: string): void {
    update({ open: null, page: { git: group }, pane: 'detail' });
  }

  /** Eine Datei aus der Git-Seite; der Betrachter wählt Änderung oder ganze Datei selbst. */
  function openGitPageFile(group: string, entryKey: string, path: string): void {
    openTarget({
      source: 'repo',
      ownerId: null,
      group,
      entryKey,
      path,
      view: null,
      step: 'all',
      line: null,
    });
  }

  const openGit: ((group: string) => void) | null = git === null ? null : showGitPage;

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
        selected={selection.open}
        onToggle={(group: string, path: string): void => {
          toggleExpanded(expandKey(group, path));
        }}
        onToggleIgnored={toggleIgnored}
        onOpenFile={openTreeFile}
        onToggleSession={toggleSession}
        onOpenSessionFile={openSessionFile}
        onOpenGit={openGit}
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

  function renderViewer(open: OpenTarget): ReactElement {
    const isPreview: boolean = selection.previewOf === previewKeyOf(open);
    function setPreview(on: boolean): void {
      update({ previewOf: on ? previewKeyOf(open) : null });
    }
    if (open.source === 'session') {
      const owner: SessionFileGroup | undefined = sessionListing?.groups.find(
        (candidate: SessionFileGroup) => candidate.sessionId === open.ownerId,
      );
      return (
        <SessionFileViewer
          key={`${open.ownerId ?? ''}|${open.path}`}
          sessionId={sessionId}
          path={open.path}
          line={open.line}
          group={owner}
          file={owner?.files.find((candidate: SessionFile) => candidate.path === open.path)}
          onOverview={showOverview}
          preview={isPreview}
          onPreview={setPreview}
        />
      );
    }
    const group: RepoGroup | undefined = groups.find(
      (candidate: RepoGroup) => candidate.group === open.group,
    );
    if (group === undefined) {
      return (
        <div className="files-view__hint">
          <b>Repository nicht mehr im Vorhaben</b>
          <span className="files-view__path">{open.path}</span>
        </div>
      );
    }
    return (
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
        preview={isPreview}
        onPreview={setPreview}
      />
    );
  }

  function renderOpenFile(open: OpenTarget): ReactElement {
    return (
      <>
        {renderBackToTree()}
        {renderViewer(open)}
      </>
    );
  }

  function renderBackToTree(): ReactElement {
    return (
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
    );
  }

  function renderDetail(): ReactElement {
    if (selection.open !== null) {
      return renderOpenFile(selection.open);
    }
    if (!hasRepositories) {
      return (
        <>
          {renderBackToTree()}
          <div className="files-view__hint">
            <b>Keine Datei geöffnet</b>
            <span>Links eine Datei der Sessions wählen.</span>
          </div>
        </>
      );
    }
    if (shownChanges === null) {
      return (
        <p className={shownError === null ? 'files-view__notice' : 'files-view__error'}>
          {shownError ?? 'Dateien werden gelesen …'}
        </p>
      );
    }
    const page: FilesPage = selection.page;
    return (
      <>
        {renderBackToTree()}
        {page !== 'overview' && git !== null ? renderGitPage(page.git, git) : renderOverview()}
      </>
    );
  }

  function renderGitPage(groupKey: string, gitStatus: GitSessionStatus): ReactElement {
    if (sessionChanges === null) {
      return <p className="files-view__notice">Git-Zustand wird gelesen …</p>;
    }
    const group: RepoGroup | undefined = groups.find(
      (candidate: RepoGroup) => candidate.group === groupKey,
    );
    return (
      <GitPage
        sessionId={sessionId}
        groupName={group?.name ?? groupKey}
        group={groupKey}
        changes={sessionChanges}
        git={gitStatus}
        onBack={showOverview}
        onOpenFile={(entryKey: string, path: string): void => {
          openGitPageFile(groupKey, entryKey, path);
        }}
        onChanged={onChanged}
      />
    );
  }

  function renderOverview(): ReactElement {
    return (
      <>
        <FilesOverview
          key={sessionFilter ?? 'all'}
          groups={groups}
          scope={scope}
          filterNumber={filterSession?.number ?? null}
          commitsByGroup={commitsByGroup}
          behindByGroup={behindByGroup}
          untrackedBefore={shownChanges?.untrackedBefore ?? null}
          plainFolders={shownChanges?.plainFolders ?? NO_FOLDERS}
          onOpenGit={openGit}
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
      {hasRepositories && (
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
      )}
      <div className="files-view__body" data-pane={selection.pane}>
        <div className="files-view__left" style={treeWidthStyle(treeWidth.width)}>
          {hasRepositories && (
            <>
              <button
                type="button"
                className={`files-view__home${isHome ? ' files-view__home--on' : ''}`}
                aria-current={isHome ? 'page' : undefined}
                onClick={showOverview}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                  <circle
                    cx="7"
                    cy="7"
                    r="5.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.3"
                  />
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
            </>
          )}
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
