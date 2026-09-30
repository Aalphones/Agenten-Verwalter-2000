import { useState } from 'react';
import type { MouseEvent, ReactElement } from 'react';
import { Popover } from '@/components/Popover';
import { StatusIcon } from '@/components/StatusIcon';
import { RenameField, SidebarItem } from '@/app/SidebarItem';
import { mostUrgent, projectMetaLine } from '@/features/projects/projectStatus';
import { isMetaHighlighted } from '@/features/sessions/sessionStatus';
import type { ProjectSummary } from '@/lib/bindings/ProjectSummary';
import type { SessionSummary } from '@/lib/bindings/SessionSummary';
import type { RenameKind, RenameTarget } from '@/stores/sessions';
import './SidebarProject.css';

const ARCHIVE_TITLE =
  'Blendet das Vorhaben mit allen Sessions aus der Liste aus und beendet ihre Agenten. Die Verläufe bleiben erhalten. Repositories und Worktrees bleiben, wie sie sind.';

interface SidebarProjectProps {
  project: ProjectSummary;
  /** Sessions dieses Vorhabens, aufsteigend nach Nummer. */
  sessions: readonly SessionSummary[];
  activeSessionId: string | null;
  isOverviewActive: boolean;
  isExpanded: boolean;
  renaming: RenameTarget | null;
  onToggle: () => void;
  onOpen: () => void;
  onSelectSession: (sessionId: string) => void;
  onStartRename: (kind: RenameKind, id: string) => void;
  onCommitRename: (kind: RenameKind, id: string, name: string) => void;
  onCancelRename: () => void;
  onArchive: () => void;
}

export function SidebarProject({
  project,
  sessions,
  activeSessionId,
  isOverviewActive,
  isExpanded,
  renaming,
  onToggle,
  onOpen,
  onSelectSession,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onArchive,
}: SidebarProjectProps): ReactElement {
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const isRenamingProject: boolean =
    renaming !== null && renaming.kind === 'project' && renaming.id === project.id;

  function renderRow(): ReactElement {
    if (isRenamingProject) {
      return (
        <RenameField
          name={project.name}
          label="Neuer Name des Vorhabens"
          onCommit={(name: string): void => {
            onCommitRename('project', project.id, name);
          }}
          onCancel={onCancelRename}
        />
      );
    }
    const urgent: SessionSummary | null = mostUrgent(sessions);
    const meta: string | null = projectMetaLine(sessions);
    const isDone: boolean =
      urgent === null || urgent.status === 'completed' || urgent.status === 'cancelled';
    const metaClass = `sidebar-project__meta${
      urgent !== null && isMetaHighlighted(urgent.status)
        ? ` sidebar-project__meta--${urgent.status}`
        : ''
    }`;
    return (
      <div className="sidebar-project__row">
        <button
          type="button"
          className="sidebar-project__chevron"
          aria-expanded={isExpanded}
          aria-label={`Sessions von ${project.name} ${isExpanded ? 'einklappen' : 'aufklappen'}`}
          onClick={onToggle}
        >
          <svg
            className={`sidebar-project__chevron-icon${
              isExpanded ? ' sidebar-project__chevron-icon--open' : ''
            }`}
            width="11"
            height="11"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4.5 2.5 8 6l-3.5 3.5" />
          </svg>
        </button>
        <button
          type="button"
          className={`sidebar-project__button${isOverviewActive ? ' sidebar-project__button--active' : ''}`}
          aria-current={isOverviewActive ? 'page' : undefined}
          onClick={onOpen}
          onDoubleClick={(): void => {
            onStartRename('project', project.id);
          }}
          onContextMenu={(event: MouseEvent<HTMLButtonElement>): void => {
            event.preventDefault();
            setIsMenuOpen(true);
          }}
        >
          <span className="sidebar-project__status">
            <StatusIcon status={urgent === null ? 'completed' : urgent.status} size={12} />
          </span>
          <span className="sidebar-project__text">
            <span
              className={`sidebar-project__name${isDone ? ' sidebar-project__name--done' : ''}`}
            >
              {project.name}
            </span>
            {meta !== null && <span className={metaClass}>{meta}</span>}
          </span>
        </button>
        {isMenuOpen && (
          <Popover
            label={`Aktionen für ${project.name}`}
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
              className="sidebar-project__menu-item"
              onClick={(): void => {
                setIsMenuOpen(false);
                onStartRename('project', project.id);
              }}
            >
              <span>Umbenennen</span>
              <kbd className="sidebar-project__menu-key">F2</kbd>
            </button>
            <button
              type="button"
              role="menuitem"
              className="sidebar-project__menu-item"
              title={ARCHIVE_TITLE}
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

  return (
    <div className="sidebar-project">
      {renderRow()}
      {isExpanded && (
        <div className="sidebar-project__sessions">
          {sessions.map((session: SessionSummary) => (
            <SidebarItem
              key={session.id}
              session={session}
              isActive={session.id === activeSessionId}
              isRenaming={
                renaming !== null && renaming.kind === 'session' && renaming.id === session.id
              }
              onSelect={(): void => {
                onSelectSession(session.id);
              }}
              onStartRename={(): void => {
                onStartRename('session', session.id);
              }}
              onCommitRename={(name: string): void => {
                onCommitRename('session', session.id, name);
              }}
              onCancelRename={onCancelRename}
            />
          ))}
        </div>
      )}
    </div>
  );
}
