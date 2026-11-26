import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactElement } from 'react';
import { useVirtualizer, type VirtualItem } from '@tanstack/react-virtual';
import { sessionFileKey } from '@/features/files/buildSessionRows';
import type { SessionRow } from '@/features/files/buildSessionRows';
import type { TreeRow } from '@/features/files/buildTreeRows';
import { ChangeMarks } from '@/features/files/ChangeMarks';
import { FileTypeIcon } from '@/features/files/FileTypeIcon';
import { FolderIcon } from '@/features/files/FolderIcon';
import { SessionFilesRow } from '@/features/files/SessionFilesNode';
import type { TreeItemProps } from '@/features/files/SessionFilesNode';
import { treeIndent } from '@/features/files/treeIndent';
import { TreeToggle } from '@/features/files/TreeToggle';
import { BranchIcon } from '@/features/git/GitIcons';
import type { SessionFile } from '@/lib/bindings/SessionFile';
import type { SessionFileGroup } from '@/lib/bindings/SessionFileGroup';
import type { FileSource, FilesMode } from '@/stores/files';
import './RepoTree.css';

const OVERSCAN = 16;
const ROW_HEIGHT = 24;
const GROUP_HEIGHT = 44;
const SESSION_GROUP_HEIGHT = 28;
const NOTE_HEIGHT = 30;

type RowOf<Kind extends TreeRow['kind']> = Extract<TreeRow, { kind: Kind }>;

export interface SelectedPath {
  source: FileSource;
  group: string;
  path: string;
  /** Bei `session` die Session, unter deren Gruppe die Datei gewählt wurde; sonst `null`. */
  ownerId: string | null;
}

interface RepoTreeProps {
  rows: readonly TreeRow[];
  mode: FilesMode;
  selected: SelectedPath | null;
  /** Klappt Knoten oder Ordner auf oder zu (Schlüssel `<Gruppe>:<Pfad>`). */
  onToggle: (group: string, path: string) => void;
  /** Klappt einen ignorierten Ordner auf oder zu und liest beim ersten Mal seine Kinder. */
  onToggleIgnored: (row: RowOf<'ignored'>) => void;
  onOpenFile: (row: RowOf<'file'>) => void;
  /** Klappt eine Zeile des Knotens „Session-Dateien“ auf oder zu (`key` der Zeile). */
  onToggleSession: (key: string) => void;
  onOpenSessionFile: (file: SessionFile, group: SessionFileGroup) => void;
  /** Öffnet die Git-Seite des Knotens (`group`); `null`, wo keine Session sichtbar ist. */
  onOpenGit: ((group: string) => void) | null;
}

function sessionRowHeight(row: SessionRow): number {
  switch (row.kind) {
    case 'sfHead':
      return GROUP_HEIGHT;
    case 'sfGroup':
      return SESSION_GROUP_HEIGHT;
    case 'sfNote':
    case 'sfError':
      return NOTE_HEIGHT;
    default:
      return ROW_HEIGHT;
  }
}

function estimateHeight(row: TreeRow | undefined): number {
  if (row === undefined) {
    return ROW_HEIGHT;
  }
  if (row.kind === 'session') {
    return sessionRowHeight(row.row);
  }
  if (row.kind === 'group') {
    return GROUP_HEIGHT;
  }
  return row.kind === 'note' || row.kind === 'error' ? NOTE_HEIGHT : ROW_HEIGHT;
}

function isExpandable(row: TreeRow): boolean {
  if (row.kind === 'session') {
    return 'open' in row.row;
  }
  return row.kind === 'group' || row.kind === 'dir' || (row.kind === 'ignored' && row.dir);
}

function isOpenRow(row: TreeRow): boolean {
  if (row.kind === 'session') {
    return 'open' in row.row && row.row.open;
  }
  if (row.kind === 'group' || row.kind === 'dir' || row.kind === 'ignored') {
    return row.open;
  }
  return false;
}

function isFocusable(row: TreeRow | undefined): boolean {
  if (row === undefined) {
    return false;
  }
  if (row.kind === 'session') {
    return row.row.kind !== 'sfNote' && row.row.kind !== 'sfError';
  }
  return row.kind !== 'note' && row.kind !== 'error';
}

/** Kopfzeile eines Knotens: ein Repository oder „Session-Dateien“. */
function isHeadRow(row: TreeRow): boolean {
  return row.kind === 'group' || (row.kind === 'session' && row.row.kind === 'sfHead');
}

/** Schlüssel der Baumzeile, die zur gewählten Datei gehört. */
function rowKeyOf(selected: SelectedPath | null): string | null {
  if (selected === null) {
    return null;
  }
  return selected.source === 'session'
    ? sessionFileKey(selected.ownerId ?? '', selected.path)
    : `${selected.group}|f|${selected.path}`;
}

function RepositoryIcon(): ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M3.5 2h8a1 1 0 0 1 1 1v10.5h-8a1.5 1.5 0 0 1 0-3h8M5.8 4.5h4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Der Baum „Dateien“: je Repository-Knoten eine Kopfzeile, darunter Ordner und Dateien; virtualisiert, mit
 *  Pfeiltasten bedienbar (auf/ab wandert, rechts klappt auf, links klappt zu, Enter öffnet). */
export function RepoTree({
  rows,
  mode,
  selected,
  onToggle,
  onToggleIgnored,
  onOpenFile,
  onToggleSession,
  onOpenSessionFile,
  onOpenGit,
}: RepoTreeProps): ReactElement {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const focusPendingRef = useRef<boolean>(false);
  const revealedKeyRef = useRef<string | null>(null);

  // Die Warnung gilt dem React Compiler, den das Projekt nicht nutzt; die Bibliothek schreibt ADR 002 vor.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: (): HTMLDivElement | null => scrollRef.current,
    estimateSize: (index: number): number => estimateHeight(rows[index]),
    getItemKey: (index: number): string => rows[index]?.key ?? String(index),
    overscan: OVERSCAN,
    // Eine angesprungene Zeile landet nicht unter der angehefteten Kopfzeile.
    scrollPaddingStart: GROUP_HEIGHT,
  });

  const foundIndex: number =
    activeKey === null ? -1 : rows.findIndex((row: TreeRow) => row.key === activeKey);
  const activeIndex: number = foundIndex >= 0 ? foundIndex : rows.findIndex(isFocusable);

  // Eine von außen gewählte Datei (Suche, Chat-Link) scrollt in den sichtbaren Bereich, sobald ihre Zeile im Baum
  // steht. Ohne Abhängigkeiten: in schmaler Breite ist der Baum ausgeblendet und kann erst beim Anzeigen scrollen.
  const selectedKey: string | null = rowKeyOf(selected);
  const selectedIndex: number =
    selectedKey === null ? -1 : rows.findIndex((row: TreeRow) => row.key === selectedKey);
  useEffect(() => {
    if (selectedKey === null) {
      revealedKeyRef.current = null;
      return;
    }
    const isShown: boolean = (scrollRef.current?.clientHeight ?? 0) > 0;
    if (isShown && selectedIndex >= 0 && revealedKeyRef.current !== selectedKey) {
      revealedKeyRef.current = selectedKey;
      virtualizer.scrollToIndex(selectedIndex, { align: 'auto' });
    }
  });

  useEffect(() => {
    if (!focusPendingRef.current || activeIndex < 0) {
      return;
    }
    const element: Element | null | undefined = scrollRef.current?.querySelector(
      `[data-row-index="${String(activeIndex)}"]`,
    );
    if (element instanceof HTMLElement) {
      focusPendingRef.current = false;
      element.focus({ preventScroll: true });
    }
  });

  function activate(row: TreeRow): void {
    switch (row.kind) {
      case 'group':
        onToggle(row.group.group, '');
        return;
      case 'dir':
        onToggle(row.group, row.path);
        return;
      case 'file':
        onOpenFile(row);
        return;
      case 'ignored':
        if (row.dir) {
          onToggleIgnored(row);
        }
        return;
      case 'session':
        activateSession(row.row);
        return;
      case 'note':
      case 'error':
        return;
    }
  }

  function activateSession(row: SessionRow): void {
    switch (row.kind) {
      case 'sfHead':
      case 'sfGroup':
      case 'sfPlace':
      case 'sfFolder':
        onToggleSession(row.key);
        return;
      case 'sfFile':
        onOpenSessionFile(row.file, row.group);
        return;
      case 'sfNote':
      case 'sfError':
        return;
    }
  }

  function moveTo(index: number): void {
    const row: TreeRow | undefined = rows[index];
    if (row === undefined) {
      return;
    }
    setActiveKey(row.key);
    focusPendingRef.current = true;
    virtualizer.scrollToIndex(index, { align: 'auto' });
  }

  function step(from: number, direction: 1 | -1): void {
    for (let index = from + direction; index >= 0 && index < rows.length; index += direction) {
      if (isFocusable(rows[index])) {
        moveTo(index);
        return;
      }
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>, index: number, row: TreeRow): void {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        step(index, 1);
        return;
      case 'ArrowUp':
        event.preventDefault();
        step(index, -1);
        return;
      case 'ArrowRight':
        if (isExpandable(row) && !isOpenRow(row)) {
          event.preventDefault();
          activate(row);
        }
        return;
      case 'ArrowLeft':
        if (isExpandable(row) && isOpenRow(row)) {
          event.preventDefault();
          activate(row);
        }
        return;
      case 'Enter':
      case ' ':
        event.preventDefault();
        activate(row);
        return;
      default:
        return;
    }
  }

  function rowProps(
    row: TreeRow,
    index: number,
    level: number,
  ): {
    role: 'treeitem';
    tabIndex: number;
    'aria-level': number;
    'data-row-index': number;
    onClick: () => void;
    onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
    onFocus: () => void;
  } {
    return {
      role: 'treeitem',
      tabIndex: index === activeIndex ? 0 : -1,
      'aria-level': level,
      'data-row-index': index,
      onClick: (): void => {
        setActiveKey(row.key);
        activate(row);
      },
      onKeyDown: (event: KeyboardEvent<HTMLDivElement>): void => {
        handleKeyDown(event, index, row);
      },
      onFocus: (): void => {
        setActiveKey(row.key);
      },
    };
  }

  function renderGroup(row: RowOf<'group'>, index: number, isPinned: boolean): ReactElement {
    const { group } = row;
    const sub: string = `Codebasis ${group.baseRef}${group.branchLabel === '' ? '' : ` · ${group.branchLabel}`}`;
    const props = isPinned
      ? {
          role: 'presentation' as const,
          onClick: (): void => {
            activate(row);
          },
        }
      : { ...rowProps(row, index, 1), 'aria-expanded': row.open };
    return (
      <div
        className={`repo-tree__group${isPinned ? ' repo-tree__group--pinned' : ''}`}
        title={`${group.name} — ${sub}`}
        {...props}
      >
        <TreeToggle open={row.open} />
        <RepositoryIcon />
        <span className="repo-tree__group-text">
          <span className="repo-tree__group-name">{group.name}</span>
          <span className="repo-tree__group-sub">{sub}</span>
        </span>
        {group.files.length > 0 ? (
          <ChangeMarks added={group.added} deleted={group.deleted} />
        ) : (
          <span className="repo-tree__quiet">keine Änderungen</span>
        )}
        {onOpenGit !== null && (
          <button
            type="button"
            className="repo-tree__git"
            title={`Git-Werkzeuge für ${group.name}`}
            tabIndex={isPinned ? -1 : 0}
            onClick={(event): void => {
              event.stopPropagation();
              onOpenGit(group.group);
            }}
            onKeyDown={(event): void => {
              event.stopPropagation();
            }}
          >
            <BranchIcon size={13} />
            Git
          </button>
        )}
      </div>
    );
  }

  function renderDir(row: RowOf<'dir'>, index: number): ReactElement {
    const showCount: boolean = row.count > 0 && (mode === 'all' || !row.open);
    return (
      <div
        className={`repo-tree__row${row.count > 0 ? ' repo-tree__row--changed' : ''}`}
        style={treeIndent(row.depth)}
        title={row.path}
        aria-expanded={row.open}
        {...rowProps(row, index, row.depth + 1)}
      >
        <TreeToggle open={row.open} />
        <FolderIcon open={row.open} />
        <span className="repo-tree__name">{row.label}</span>
        {showCount && (
          <span
            className="repo-tree__count"
            title={row.count === 1 ? '1 geänderte Datei' : `${String(row.count)} geänderte Dateien`}
          >
            {row.count}
          </span>
        )}
      </div>
    );
  }

  function renderFile(row: RowOf<'file'>, index: number): ReactElement {
    const isSelected: boolean =
      selected !== null && selected.group === row.group && selected.path === row.path;
    const changed: boolean = row.file !== null;
    return (
      <div
        className={`repo-tree__row repo-tree__row--file${changed ? ' repo-tree__row--changed' : ''}${
          isSelected ? ' repo-tree__row--selected' : ''
        }`}
        style={treeIndent(row.depth)}
        title={row.link ? `${row.path} — symbolischer Link` : row.path}
        aria-selected={isSelected}
        {...rowProps(row, index, row.depth + 1)}
      >
        <TreeToggle open={null} />
        <FileTypeIcon path={row.path} />
        <span className="repo-tree__name">
          {row.name}
          {row.link && <span className="repo-tree__link"> ↪</span>}
        </span>
        {row.file !== null && (
          <ChangeMarks
            added={row.file.shown.stat.added}
            deleted={row.file.shown.stat.deleted}
            kind={row.file.shown.stat.kind}
            binary={row.file.shown.stat.binary}
          />
        )}
      </div>
    );
  }

  function renderIgnored(row: RowOf<'ignored'>, index: number): ReactElement {
    const expanded = row.dir ? { 'aria-expanded': row.open } : {};
    return (
      <div
        className="repo-tree__row repo-tree__row--ignored"
        style={treeIndent(row.depth)}
        title={
          row.dir ? 'Von Git ignoriert – wird erst beim Aufklappen gelesen' : 'Von Git ignoriert'
        }
        {...expanded}
        {...rowProps(row, index, row.depth + 1)}
      >
        <TreeToggle open={row.dir ? row.open : null} />
        {row.dir ? <FolderIcon open={row.open} /> : <FileTypeIcon path={row.path} />}
        <span className="repo-tree__name">{row.name}</span>
        <span className="repo-tree__ignored">ignoriert</span>
      </div>
    );
  }

  function renderSession(row: RowOf<'session'>, index: number, isPinned: boolean): ReactElement {
    const entry: SessionRow = row.row;
    let itemProps: TreeItemProps = {};
    if (isPinned) {
      itemProps = {
        role: 'presentation',
        onClick: (): void => {
          activate(row);
        },
      };
    } else if (isFocusable(row)) {
      itemProps = rowProps(row, index, entry.kind === 'sfHead' ? 1 : entry.depth + 2);
    }
    const isSelected: boolean =
      entry.kind === 'sfFile' &&
      selected?.source === 'session' &&
      selected.path === entry.file.path;
    return (
      <SessionFilesRow
        row={entry}
        isSelected={isSelected}
        isPinned={isPinned}
        itemProps={itemProps}
      />
    );
  }

  function renderRow(row: TreeRow | undefined, index: number): ReactElement | null {
    if (row === undefined) {
      return null;
    }
    switch (row.kind) {
      case 'group':
        return renderGroup(row, index, false);
      case 'dir':
        return renderDir(row, index);
      case 'file':
        return renderFile(row, index);
      case 'ignored':
        return renderIgnored(row, index);
      case 'session':
        return renderSession(row, index, false);
      case 'note':
        return (
          <p className="repo-tree__note" style={treeIndent(row.depth)}>
            {row.text}
          </p>
        );
      case 'error':
        return (
          <p className="repo-tree__error" style={treeIndent(row.depth)} role="alert">
            {row.text}
          </p>
        );
    }
  }

  // Die Kopfzeile des Knotens, in dem die Ansicht gerade steht, bleibt oben stehen.
  function pinnedHead(): ReactElement | null {
    const offset: number = virtualizer.scrollOffset ?? 0;
    let pinned: { row: TreeRow; index: number } | null = null;
    for (const item of virtualizer.measurementsCache) {
      if (item.start > offset) {
        break;
      }
      const row: TreeRow | undefined = rows[item.index];
      if (row !== undefined && isHeadRow(row)) {
        pinned = item.start < offset ? { row, index: item.index } : null;
      }
    }
    if (pinned === null) {
      return null;
    }
    let content: ReactElement | null = null;
    if (pinned.row.kind === 'group') {
      content = renderGroup(pinned.row, pinned.index, true);
    } else if (pinned.row.kind === 'session') {
      content = renderSession(pinned.row, pinned.index, true);
    }
    return <div className="repo-tree__pin">{content}</div>;
  }

  return (
    <div
      ref={scrollRef}
      className={`repo-tree repo-tree--${mode}`}
      role="tree"
      aria-label="Dateien des Vorhabens"
    >
      {pinnedHead()}
      <div
        className="repo-tree__surface"
        style={{ height: `${String(virtualizer.getTotalSize())}px` }}
      >
        {virtualizer.getVirtualItems().map((item: VirtualItem) => (
          <div
            key={item.key}
            ref={virtualizer.measureElement}
            data-index={item.index}
            className="repo-tree__item"
            style={{ transform: `translateY(${String(item.start)}px)` }}
          >
            {renderRow(rows[item.index], item.index)}
          </div>
        ))}
      </div>
    </div>
  );
}
