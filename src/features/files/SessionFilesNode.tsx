import type { HTMLAttributes, ReactElement } from 'react';
import { formatCount } from '@/features/changes/changesScope';
import type { SessionRow } from '@/features/files/buildSessionRows';
import { FileTypeIcon } from '@/features/files/FileTypeIcon';
import { FolderIcon } from '@/features/files/FolderIcon';
import { treeIndent } from '@/features/files/treeIndent';
import { TreeToggle } from '@/features/files/TreeToggle';
import type { SessionFile } from '@/lib/bindings/SessionFile';
import './SessionFilesNode.css';

type SessionRowOf<Kind extends SessionRow['kind']> = Extract<SessionRow, { kind: Kind }>;

/** Rolle, Fokus und Bedienung der Zeile; sie kommen vom Baum, damit Maus und Tastatur überall gleich wirken. */
export type TreeItemProps = HTMLAttributes<HTMLDivElement> & { 'data-row-index'?: number };

interface SessionFilesRowProps {
  row: SessionRow;
  /** Die Zeile ist die offene Datei. */
  isSelected: boolean;
  /** Die Kopfzeile steht angeheftet über der Liste. */
  isPinned: boolean;
  itemProps: TreeItemProps;
}

/** „verlinkt“ trägt nur eine Datei außerhalb der Scratchpads, die die Session genannt, aber nicht geschrieben
 *  hat. */
function isLinkedOnly(file: SessionFile): boolean {
  return file.origin === 'elsewhere' && file.linked && !file.written;
}

/** Eine Zeile des Knotens „Session-Dateien“. */
export function SessionFilesRow({
  row,
  isSelected,
  isPinned,
  itemProps,
}: SessionFilesRowProps): ReactElement {
  function renderHead(head: SessionRowOf<'sfHead'>): ReactElement {
    const expanded = isPinned ? {} : { 'aria-expanded': head.open };
    return (
      <div
        className={`repo-tree__group${isPinned ? ' repo-tree__group--pinned' : ''}`}
        title={`Session-Dateien — ${head.sub}`}
        {...expanded}
        {...itemProps}
      >
        <TreeToggle open={head.open} />
        <FolderIcon open={head.open} />
        <span className="repo-tree__group-text">
          <span className="repo-tree__group-name">Session-Dateien</span>
          <span className="repo-tree__group-sub">{head.sub}</span>
        </span>
      </div>
    );
  }

  function renderGroup(entry: SessionRowOf<'sfGroup'>): ReactElement {
    return (
      <div
        className="repo-tree__row session-files__group"
        style={treeIndent(entry.depth)}
        title={`#${String(entry.group.number)} ${entry.group.name}`}
        aria-expanded={entry.open}
        {...itemProps}
      >
        <TreeToggle open={entry.open} />
        <span className="session-files__number">#{entry.group.number}</span>
        <span className="repo-tree__name session-files__group-name">{entry.group.name}</span>
        {entry.isOwn && <span className="session-files__own">diese Session</span>}
        <span className="repo-tree__count">{formatCount(entry.group.files.length)}</span>
      </div>
    );
  }

  function renderPlace(place: SessionRowOf<'sfPlace'>): ReactElement {
    return (
      <div
        className="repo-tree__row"
        style={treeIndent(place.depth)}
        title={place.title}
        aria-expanded={place.open}
        {...itemProps}
      >
        <TreeToggle open={place.open} />
        <span className="repo-tree__name session-files__place-name">{place.label}</span>
        <span className="repo-tree__count">{formatCount(place.count)}</span>
      </div>
    );
  }

  function renderFolder(folder: SessionRowOf<'sfFolder'>): ReactElement {
    return (
      <div
        className="repo-tree__row"
        style={treeIndent(folder.depth)}
        title={folder.farPath ?? folder.label}
        aria-expanded={folder.open}
        {...itemProps}
      >
        <TreeToggle open={folder.open} />
        {folder.farPath === null ? (
          <span className="repo-tree__name session-files__folder-name">{folder.label}</span>
        ) : (
          // Rechtsläufig, damit der Anfang gekürzt wird; der Pfad selbst bleibt links nach rechts.
          <span className="repo-tree__name session-files__far-name">
            <bdi dir="ltr">{folder.farPath}</bdi>
          </span>
        )}
      </div>
    );
  }

  function renderFile(entry: SessionRowOf<'sfFile'>): ReactElement {
    const { file } = entry;
    return (
      <div
        className={`repo-tree__row${isSelected ? ' repo-tree__row--selected' : ''}${
          file.exists ? '' : ' session-files__file--gone'
        }`}
        style={treeIndent(entry.depth)}
        title={file.path}
        aria-selected={isSelected}
        {...itemProps}
      >
        <TreeToggle open={null} />
        <FileTypeIcon path={file.name} />
        <span className="repo-tree__name">{file.name}</span>
        {isLinkedOnly(file) && <span className="session-files__tag">verlinkt</span>}
        {!file.exists && <span className="session-files__tag">nicht mehr da</span>}
      </div>
    );
  }

  switch (row.kind) {
    case 'sfHead':
      return renderHead(row);
    case 'sfGroup':
      return renderGroup(row);
    case 'sfPlace':
      return renderPlace(row);
    case 'sfFolder':
      return renderFolder(row);
    case 'sfFile':
      return renderFile(row);
    case 'sfNote':
      return (
        <p className="repo-tree__note" style={treeIndent(row.depth)}>
          {row.text}
        </p>
      );
    case 'sfError':
      return (
        <p className="repo-tree__error" style={treeIndent(row.depth)} role="alert">
          {row.text}
        </p>
      );
  }
}
