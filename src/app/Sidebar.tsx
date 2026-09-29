import { useEffect } from 'react';
import type { ReactElement } from 'react';
import { SidebarItem } from '@/app/SidebarItem';
import { GROUP_LABEL, GROUP_ORDER, STATUS_GROUP } from '@/features/sessions/sessionStatus';
import type { SessionGroup } from '@/features/sessions/sessionStatus';
import type { SessionSummary } from '@/lib/bindings/SessionSummary';
import { archiveSession, renameSession } from '@/lib/sessions';
import { useSessionsStore } from '@/stores/sessions';
import './Sidebar.css';

interface SidebarProps {
  sessions: readonly SessionSummary[];
  activeSessionId: string | null;
  onSelect: (sessionId: string) => void;
  onNew: () => void;
  onArchived: (sessionId: string) => void;
}

export function Sidebar({
  sessions,
  activeSessionId,
  onSelect,
  onNew,
  onArchived,
}: SidebarProps): ReactElement {
  const renamingId: string | null = useSessionsStore((state) => state.renamingId);
  const startRename = useSessionsStore((state) => state.startRename);
  const stopRename = useSessionsStore((state) => state.stopRename);

  // F2 startet das Umbenennen der aktiven Session — außer der Fokus liegt in einem Textfeld.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key !== 'F2' || event.defaultPrevented) {
        return;
      }
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('input, textarea')) {
        return;
      }
      if (activeSessionId !== null) {
        startRename(activeSessionId);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return (): void => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeSessionId, startRename]);

  function commitRename(sessionId: string, name: string): void {
    renameSession(sessionId, name).catch((reason: unknown) => {
      console.error('Session nicht umbenennbar', reason);
    });
    stopRename();
  }

  function archive(sessionId: string): void {
    archiveSession(sessionId)
      .then(() => {
        onArchived(sessionId);
      })
      .catch((reason: unknown) => {
        console.error('Session nicht archivierbar', reason);
      });
  }

  function renderGroup(group: SessionGroup): ReactElement | null {
    const members: SessionSummary[] = sessions.filter(
      (session: SessionSummary) => STATUS_GROUP[session.status] === group,
    );
    if (members.length === 0) {
      return null;
    }
    return (
      <section key={group} className="sidebar__group">
        <h2 className="sidebar__group-title">
          <span>{GROUP_LABEL[group]}</span>
          <span className="sidebar__group-count">{members.length}</span>
        </h2>
        {members.map((session: SessionSummary) => (
          <SidebarItem
            key={session.id}
            session={session}
            isActive={session.id === activeSessionId}
            isRenaming={session.id === renamingId}
            onSelect={(): void => {
              onSelect(session.id);
            }}
            onStartRename={(): void => {
              startRename(session.id);
            }}
            onCommitRename={(name: string): void => {
              commitRename(session.id, name);
            }}
            onCancelRename={(): void => {
              stopRename();
            }}
            onArchive={(): void => {
              archive(session.id);
            }}
          />
        ))}
      </section>
    );
  }

  return (
    <nav className="sidebar" aria-label="Sessions">
      <div className="sidebar__brand">
        <svg
          width="16"
          height="16"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="1.5" y="1.5" width="7" height="7" rx="2" />
          <rect x="5.5" y="5.5" width="7" height="7" rx="2" />
        </svg>
        <span className="sidebar__brand-name">Agenten Verwalter 2000</span>
      </div>
      <div className="sidebar__actions">
        <button type="button" className="sidebar__new" onClick={onNew}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M7 2.5v9M2.5 7h9" />
          </svg>
          <span className="sidebar__new-label">Neue Session</span>
          <kbd className="sidebar__new-key">Ctrl N</kbd>
        </button>
      </div>
      <div className="sidebar__list">
        {sessions.length === 0 && <p className="sidebar__empty">Noch keine Sessions.</p>}
        {GROUP_ORDER.map((group: SessionGroup) => renderGroup(group))}
      </div>
    </nav>
  );
}
