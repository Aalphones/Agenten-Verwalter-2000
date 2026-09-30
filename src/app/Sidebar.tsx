import { useEffect } from 'react';
import type { ReactElement } from 'react';
import { SidebarProject } from '@/app/SidebarProject';
import { projectGroup, sessionsOf } from '@/features/projects/projectStatus';
import { GROUP_LABEL, GROUP_ORDER } from '@/features/sessions/sessionStatus';
import type { SessionGroup } from '@/features/sessions/sessionStatus';
import type { ProjectSummary } from '@/lib/bindings/ProjectSummary';
import type { SessionSummary } from '@/lib/bindings/SessionSummary';
import { archiveProject, renameProject } from '@/lib/projects';
import { renameSession } from '@/lib/sessions';
import { useSessionsStore } from '@/stores/sessions';
import type { RenameKind, RenameTarget } from '@/stores/sessions';
import './Sidebar.css';

interface SidebarProps {
  projects: readonly ProjectSummary[];
  sessions: readonly SessionSummary[];
  activeSessionId: string | null;
  activeProjectId: string | null;
  showProjectOverview: boolean;
  onSelectSession: (sessionId: string) => void;
  onSelectProject: (projectId: string) => void;
  onNew: () => void;
  onArchived: (projectId: string) => void;
}

export function Sidebar({
  projects,
  sessions,
  activeSessionId,
  activeProjectId,
  showProjectOverview,
  onSelectSession,
  onSelectProject,
  onNew,
  onArchived,
}: SidebarProps): ReactElement {
  const renaming: RenameTarget | null = useSessionsStore((state) => state.renaming);
  const expanded: Record<string, boolean> = useSessionsStore((state) => state.expanded);
  const startRename = useSessionsStore((state) => state.startRename);
  const stopRename = useSessionsStore((state) => state.stopRename);
  const setExpanded = useSessionsStore((state) => state.setExpanded);

  // F2 benennt das Vorhaben um, dessen Übersicht offen ist, sonst die aktive Session — außer der Fokus liegt in einem Textfeld.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key !== 'F2' || event.defaultPrevented) {
        return;
      }
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('input, textarea')) {
        return;
      }
      if (showProjectOverview && activeProjectId !== null) {
        startRename('project', activeProjectId);
      } else if (activeSessionId !== null) {
        startRename('session', activeSessionId);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return (): void => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeSessionId, activeProjectId, showProjectOverview, startRename]);

  function commitRename(kind: RenameKind, id: string, name: string): void {
    const rename: Promise<void> =
      kind === 'project' ? renameProject(id, name) : renameSession(id, name);
    rename.catch((reason: unknown) => {
      console.error('Nicht umbenennbar', reason);
    });
    stopRename();
  }

  // Archivieren gibt es nur für das ganze Vorhaben — alle seine Sessions verlassen die Liste.
  function archive(projectId: string): void {
    archiveProject(projectId)
      .then(() => {
        onArchived(projectId);
      })
      .catch((reason: unknown) => {
        console.error('Vorhaben nicht archivierbar', reason);
      });
  }

  function open(project: ProjectSummary, projectSessions: readonly SessionSummary[]): void {
    const [only] = projectSessions;
    if (projectSessions.length === 1 && only !== undefined) {
      onSelectSession(only.id);
      return;
    }
    onSelectProject(project.id);
  }

  function renderGroup(group: SessionGroup): ReactElement | null {
    const members = projects
      .map((project: ProjectSummary) => ({
        project,
        projectSessions: sessionsOf(project.id, sessions),
      }))
      .filter(({ projectSessions }) => projectGroup(projectSessions) === group);
    if (members.length === 0) {
      return null;
    }
    return (
      <section key={group} className="sidebar__group">
        <h2 className="sidebar__group-title">
          <span>{GROUP_LABEL[group]}</span>
          <span className="sidebar__group-count">{members.length}</span>
        </h2>
        {members.map(({ project, projectSessions }) => {
          const isOverviewActive: boolean = showProjectOverview && activeProjectId === project.id;
          const containsActiveSession: boolean = projectSessions.some(
            (session: SessionSummary) => session.id === activeSessionId,
          );
          const isExpanded: boolean =
            expanded[project.id] ?? (containsActiveSession || isOverviewActive);
          return (
            <SidebarProject
              key={project.id}
              project={project}
              sessions={projectSessions}
              activeSessionId={activeSessionId}
              isOverviewActive={isOverviewActive}
              isExpanded={isExpanded}
              renaming={renaming}
              onToggle={(): void => {
                setExpanded(project.id, !isExpanded);
              }}
              onOpen={(): void => {
                open(project, projectSessions);
              }}
              onSelectSession={onSelectSession}
              onStartRename={startRename}
              onCommitRename={commitRename}
              onCancelRename={stopRename}
              onArchive={(): void => {
                archive(project.id);
              }}
            />
          );
        })}
      </section>
    );
  }

  return (
    <nav className="sidebar" aria-label="Vorhaben">
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
          <span className="sidebar__new-label">Neues Vorhaben</span>
          <kbd className="sidebar__new-key">Ctrl N</kbd>
        </button>
      </div>
      <div className="sidebar__list">
        {projects.length === 0 && <p className="sidebar__empty">Noch keine Vorhaben.</p>}
        {GROUP_ORDER.map((group: SessionGroup) => renderGroup(group))}
      </div>
    </nav>
  );
}
