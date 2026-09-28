import type { ReactElement } from 'react';
import { StatusIcon } from '@/components/StatusIcon';
import {
  GROUP_LABEL,
  GROUP_ORDER,
  STATUS_GROUP,
  isMetaHighlighted,
  metaLine,
} from '@/features/sessions/sessionStatus';
import type { SessionGroup } from '@/features/sessions/sessionStatus';
import type { SessionSummary } from '@/lib/bindings/SessionSummary';
import './Sidebar.css';

interface SidebarProps {
  sessions: readonly SessionSummary[];
  activeSessionId: string | null;
  onSelect: (sessionId: string) => void;
  onNew: () => void;
}

export function Sidebar({
  sessions,
  activeSessionId,
  onSelect,
  onNew,
}: SidebarProps): ReactElement {
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
        {members.map((session: SessionSummary) => renderItem(session))}
      </section>
    );
  }

  function renderItem(session: SessionSummary): ReactElement {
    const isActive: boolean = session.id === activeSessionId;
    const meta: string | null = metaLine(session);
    const itemClass = `sidebar__item${isActive ? ' sidebar__item--active' : ''}`;
    const nameClass = `sidebar__name${
      session.status === 'completed' || session.status === 'cancelled' ? ' sidebar__name--done' : ''
    }`;
    const metaClass = `sidebar__meta${
      isMetaHighlighted(session.status) ? ` sidebar__meta--${session.status}` : ''
    }`;
    return (
      <button
        key={session.id}
        type="button"
        className={itemClass}
        aria-current={isActive ? 'page' : undefined}
        onClick={(): void => {
          onSelect(session.id);
        }}
      >
        <span className="sidebar__status">
          <StatusIcon status={session.status} size={12} />
        </span>
        <span className="sidebar__text">
          <span className={nameClass}>{session.name}</span>
          {meta !== null && <span className={metaClass}>{meta}</span>}
        </span>
      </button>
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
