import { useRef, useState } from 'react';
import type { ChangeEvent, FocusEvent, KeyboardEvent, MouseEvent, ReactElement } from 'react';
import { Popover } from '@/components/Popover';
import { StatusIcon } from '@/components/StatusIcon';
import type { DisplayStatus } from '@/features/sessions/sessionStatus';
import type { SessionSummary } from '@/lib/bindings/SessionSummary';
import './SidebarItem.css';

interface SidebarItemProps {
  session: SessionSummary;
  /** Symbol-Status; kann `handoff` sein, was der Core nicht kennt. */
  status: DisplayStatus;
  isActive: boolean;
  isRenaming: boolean;
  onSelect: () => void;
  onStartRename: () => void;
  onCommitRename: (name: string) => void;
  onCancelRename: () => void;
}

/** Eine Session im aufgeklappten Baum eines Vorhabens. */
export function SidebarItem({
  session,
  status,
  isActive,
  isRenaming,
  onSelect,
  onStartRename,
  onCommitRename,
  onCancelRename,
}: SidebarItemProps): ReactElement {
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);

  if (isRenaming) {
    return (
      <div className="sidebar-item">
        <RenameField
          name={session.name}
          label="Neuer Name der Session"
          onCommit={onCommitRename}
          onCancel={onCancelRename}
        />
      </div>
    );
  }

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
          <StatusIcon status={status} size={10} />
        </span>
        <span className="sidebar-item__number">#{session.number}</span>
        <span
          className={`sidebar-item__name${session.unread ? ' sidebar-item__name--unread' : ''}`}
        >
          {session.name}
        </span>
        {session.unread && (
          <span
            className="sidebar-item__unread"
            role="img"
            aria-label="Ungelesen"
            title="Neue Nachricht, seit du zuletzt in dieser Session warst"
          />
        )}
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
        </Popover>
      )}
    </div>
  );
}

interface RenameFieldProps {
  name: string;
  /** Beschriftung für Screenreader. */
  label: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
}

/** Namensfeld an der Stelle einer Sidebar-Zeile; Enter speichert, Esc und Verlassen des Felds ohne Änderung brechen ab. */
export function RenameField({ name, label, onCommit, onCancel }: RenameFieldProps): ReactElement {
  const [text, setText] = useState<string>(name);
  // Enter und das folgende Blur würden sonst beide committen.
  const isDoneRef = useRef<boolean>(false);

  function commit(): void {
    if (isDoneRef.current) {
      return;
    }
    isDoneRef.current = true;
    const trimmed: string = text.trim();
    if (trimmed === '' || trimmed === name) {
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
        aria-label={label}
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
