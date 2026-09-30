import { useRef, useState } from 'react';
import type { ChangeEvent, FocusEvent, KeyboardEvent, MouseEvent, ReactElement } from 'react';
import { Popover } from '@/components/Popover';
import { StatusIcon } from '@/components/StatusIcon';
import { isMetaHighlighted, metaLine } from '@/features/sessions/sessionStatus';
import type { SessionSummary } from '@/lib/bindings/SessionSummary';
import './SidebarItem.css';

interface SidebarItemProps {
  session: SessionSummary;
  isActive: boolean;
  isRenaming: boolean;
  onSelect: () => void;
  onStartRename: () => void;
  onCommitRename: (name: string) => void;
  onCancelRename: () => void;
  onArchive: () => void;
}

export function SidebarItem({
  session,
  isActive,
  isRenaming,
  onSelect,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onArchive,
}: SidebarItemProps): ReactElement {
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);

  if (isRenaming) {
    return (
      <div className="sidebar-item">
        <RenameField session={session} onCommit={onCommitRename} onCancel={onCancelRename} />
      </div>
    );
  }

  const meta: string | null = metaLine(session);
  const nameClass = `sidebar-item__name${
    session.status === 'completed' || session.status === 'cancelled'
      ? ' sidebar-item__name--done'
      : ''
  }`;
  const metaClass = `sidebar-item__meta${
    isMetaHighlighted(session.status) ? ` sidebar-item__meta--${session.status}` : ''
  }`;

  return (
    <div className="sidebar-item">
      <button
        type="button"
        className={`sidebar-item__button${isActive ? ' sidebar-item__button--active' : ''}`}
        aria-current={isActive ? 'page' : undefined}
        onClick={onSelect}
        onDoubleClick={onStartRename}
        onContextMenu={(event: MouseEvent<HTMLButtonElement>): void => {
          event.preventDefault();
          setIsMenuOpen(true);
        }}
      >
        <span className="sidebar-item__status">
          <StatusIcon status={session.status} size={12} />
        </span>
        <span className="sidebar-item__text">
          <span className={nameClass}>{session.name}</span>
          {meta !== null && <span className={metaClass}>{meta}</span>}
        </span>
      </button>
      {isMenuOpen && (
        <Popover
          label={`Aktionen für ${session.name}`}
          placement="below"
          align="start"
          width={200}
          onClose={(): void => {
            setIsMenuOpen(false);
          }}
        >
          <button
            type="button"
            role="menuitem"
            className="sidebar-item__menu-item"
            onClick={(): void => {
              setIsMenuOpen(false);
              onStartRename();
            }}
          >
            <span>Umbenennen</span>
            <kbd className="sidebar-item__menu-key">F2</kbd>
          </button>
          <button
            type="button"
            role="menuitem"
            className="sidebar-item__menu-item"
            title="Blendet die Session aus der Liste aus. Der Verlauf bleibt erhalten. Repositories und Worktrees bleiben, wie sie sind."
            onClick={(): void => {
              setIsMenuOpen(false);
              onArchive();
            }}
          >
            Archivieren
          </button>
        </Popover>
      )}
    </div>
  );
}

interface RenameFieldProps {
  session: SessionSummary;
  onCommit: (name: string) => void;
  onCancel: () => void;
}

function RenameField({ session, onCommit, onCancel }: RenameFieldProps): ReactElement {
  const [text, setText] = useState<string>(session.name);
  // Enter und das folgende Blur würden sonst beide committen.
  const isDoneRef = useRef<boolean>(false);

  function commit(): void {
    if (isDoneRef.current) {
      return;
    }
    isDoneRef.current = true;
    const trimmed: string = text.trim();
    if (trimmed === '' || trimmed === session.name) {
      onCancel();
      return;
    }
    onCommit(trimmed);
  }

  function cancel(): void {
    if (isDoneRef.current) {
      return;
    }
    isDoneRef.current = true;
    onCancel();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit();
    } else if (event.key === 'Escape') {
      // preventDefault: sonst pausiert der Esc-Listener des Chats die laufende Session zusätzlich.
      event.preventDefault();
      cancel();
    }
  }

  return (
    <div className="sidebar-item__rename">
      <input
        type="text"
        aria-label="Neuer Name der Session"
        maxLength={60}
        autoFocus
        value={text}
        onChange={(event: ChangeEvent<HTMLInputElement>): void => {
          setText(event.target.value);
        }}
        onFocus={(event: FocusEvent<HTMLInputElement>): void => {
          event.target.select();
        }}
        onKeyDown={handleKeyDown}
        onBlur={commit}
      />
      <span className="sidebar-item__rename-hint">Enter speichert · Esc bricht ab</span>
    </div>
  );
}
