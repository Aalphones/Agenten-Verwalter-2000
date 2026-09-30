import { useRef } from 'react';
import type { ReactElement } from 'react';
import { useVirtualizer, type VirtualItem } from '@tanstack/react-virtual';
import type { FileRow } from '@/features/changes/buildFileRows';
import { EMPTY_SCOPE_TEXT, formatCount } from '@/features/changes/changesScope';
import type { ChangeKind } from '@/lib/bindings/ChangeKind';
import type { ChangeScope } from '@/lib/bindings/ChangeScope';
import type { OpenFile } from '@/stores/changes';
import './FileTree.css';

const OVERSCAN = 12;
const FILE_INDENT_BASE = 30;
const FILE_INDENT_STEP = 14;
const ESTIMATED_HEIGHT: Record<FileRow['kind'], number> = {
  repository: 36,
  branch: 19,
  error: 19,
  folder: 21,
  file: 23,
};
const FIRST_REPOSITORY_HEIGHT = 22;

const KIND_LETTER: Record<ChangeKind, { letter: string; title: string }> = {
  added: { letter: 'A', title: 'Neu angelegt' },
  modified: { letter: 'M', title: 'Geändert' },
  deleted: { letter: 'D', title: 'Gelöscht' },
};

interface FileTreeProps {
  rows: readonly FileRow[];
  scope: ChangeScope;
  openFile: OpenFile | null;
  onOpen: (file: OpenFile) => void;
}

export function FileTree({ rows, scope, openFile, onOpen }: FileTreeProps): ReactElement {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Die Warnung gilt dem React Compiler, den das Projekt nicht nutzt; die Bibliothek schreibt ADR 002 vor.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: (): HTMLDivElement | null => scrollRef.current,
    estimateSize: (index: number): number => estimateHeight(rows[index]),
    getItemKey: (index: number): string => rows[index]?.key ?? String(index),
    overscan: OVERSCAN,
  });

  function renderRow(row: FileRow | undefined): ReactElement | null {
    if (row === undefined) {
      return null;
    }
    switch (row.kind) {
      case 'repository':
        return (
          <div
            className={`file-tree__repository${row.isFirst ? '' : ' file-tree__repository--spaced'}`}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinejoin="round"
              aria-hidden="true"
              className="file-tree__repository-icon"
            >
              <path d="M2 4.2a1 1 0 0 1 1-1h2.6l1.2 1.3H11a1 1 0 0 1 1 1V10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1Z" />
            </svg>
            <span className="file-tree__repository-name">{row.name}</span>
            <span className="file-tree__added">+{formatCount(row.added)}</span>
            <span className="file-tree__deleted">−{formatCount(row.deleted)}</span>
          </div>
        );
      case 'branch':
        return <div className="file-tree__branch">{row.branch}</div>;
      case 'error':
        return <div className="file-tree__error">{row.message}</div>;
      case 'folder':
        return (
          <div
            className="file-tree__folder"
            style={{ paddingLeft: `${String(FILE_INDENT_BASE + row.depth * FILE_INDENT_STEP)}px` }}
          >
            {row.label}
          </div>
        );
      case 'file':
        return renderFile(row);
    }
  }

  function renderFile(row: Extract<FileRow, { kind: 'file' }>): ReactElement {
    const isOpen: boolean =
      openFile !== null && openFile.key === row.entryKey && openFile.path === row.path;
    const { letter, title } = KIND_LETTER[row.stat.kind];
    return (
      <button
        type="button"
        className={`file-tree__file${isOpen ? ' file-tree__file--selected' : ''}`}
        style={{ paddingLeft: `${String(FILE_INDENT_BASE + row.depth * FILE_INDENT_STEP)}px` }}
        onClick={(): void => {
          onOpen({ key: row.entryKey, path: row.path });
        }}
      >
        <span className={`file-tree__letter file-tree__letter--${row.stat.kind}`} title={title}>
          {letter}
        </span>
        <span className="file-tree__name">{row.label}</span>
        {row.isUncommitted && (
          <span
            className="file-tree__badge"
            title="Uncommitted – nur im Arbeitsverzeichnis, noch nicht committed"
          >
            uncommitted
          </span>
        )}
        {row.stat.binary ? (
          <span className="file-tree__binary" title="Binärdatei – keine Zeilenzahl">
            binär
          </span>
        ) : (
          <>
            <span className="file-tree__added">+{formatCount(row.stat.added)}</span>
            <span className="file-tree__deleted">−{formatCount(row.stat.deleted)}</span>
          </>
        )}
      </button>
    );
  }

  return (
    <div ref={scrollRef} className="file-tree">
      {rows.length === 0 ? (
        <p className="file-tree__empty">{EMPTY_SCOPE_TEXT[scope]}</p>
      ) : (
        <div
          className="file-tree__surface"
          style={{ height: `${String(virtualizer.getTotalSize())}px` }}
        >
          {virtualizer.getVirtualItems().map((item: VirtualItem) => (
            <div
              key={item.key}
              ref={virtualizer.measureElement}
              data-index={item.index}
              className="file-tree__item"
              style={{ transform: `translateY(${String(item.start)}px)` }}
            >
              {renderRow(rows[item.index])}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function estimateHeight(row: FileRow | undefined): number {
  if (row === undefined) {
    return ESTIMATED_HEIGHT.file;
  }
  if (row.kind === 'repository' && row.isFirst) {
    return FIRST_REPOSITORY_HEIGHT;
  }
  return ESTIMATED_HEIGHT[row.kind];
}
