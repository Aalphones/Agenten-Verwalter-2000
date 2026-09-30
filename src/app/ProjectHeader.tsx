import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { formatRuntime } from '@/app/SessionHeader';
import { StatusIcon } from '@/components/StatusIcon';
import { formatCount } from '@/features/changes/changesScope';
import { mostUrgent } from '@/features/projects/projectStatus';
import { STATUS_LABEL } from '@/features/sessions/sessionStatus';
import type { ProjectSummary } from '@/lib/bindings/ProjectSummary';
import type { SessionSummary } from '@/lib/bindings/SessionSummary';
import { PROJECT_VIEWS, type ProjectView } from '@/stores/sessions';
import './SessionHeader.css';

const MS_PER_SECOND = 1000;

const VIEW_LABEL: Record<ProjectView, string> = { overview: 'Übersicht', changes: 'Changes' };

interface ProjectHeaderProps {
  project: ProjectSummary;
  sessions: readonly SessionSummary[];
  activeView: ProjectView;
  /** Dateien unter „Alle“; `null`, solange die Changes nicht gelesen sind. */
  changesCount: number | null;
  onShowView: (view: ProjectView) => void;
}

export function ProjectHeader({
  project,
  sessions,
  activeView,
  changesCount,
  onShowView,
}: ProjectHeaderProps): ReactElement {
  const [now, setNow] = useState<number>(() => Date.now());
  const isTicking: boolean = sessions.some(
    (session: SessionSummary) => session.runningSince !== null,
  );

  useEffect(() => {
    if (!isTicking) {
      return undefined;
    }
    function tick(): void {
      setNow(Date.now());
    }
    // Sofort einmal, damit `now` nach einer Pause nicht bis zum ersten Intervall veraltet ist.
    const immediate: number = window.setTimeout(tick, 0);
    const timer: number = window.setInterval(tick, MS_PER_SECOND);
    return (): void => {
      window.clearTimeout(immediate);
      window.clearInterval(timer);
    };
  }, [isTicking]);

  const urgent: SessionSummary | null = mostUrgent(sessions);
  const totalRuntimeMs: number = sessions.reduce(
    (sum: number, session: SessionSummary) =>
      sum +
      session.runningMs +
      (session.runningSince === null ? 0 : Math.max(0, now - session.runningSince)),
    0,
  );
  // „Changes“ gibt es nur mit mindestens einem Repository.
  const views: readonly ProjectView[] =
    project.repositoryNames.length > 0 ? PROJECT_VIEWS : ['overview'];
  const sessionCountLabel: string =
    sessions.length === 1 ? '1 Session' : `${String(sessions.length)} Sessions`;

  return (
    <header className="session-header">
      <div className="session-header__title">
        <h1 className="session-header__name">{project.name}</h1>
        {urgent !== null && (
          <span className={`session-header__status session-header__status--${urgent.status}`}>
            <StatusIcon status={urgent.status} size={10} />
            <span>{STATUS_LABEL[urgent.status]}</span>
          </span>
        )}
      </div>
      <div className="session-header__tabs" role="tablist" aria-label="Ansicht">
        {views.map((view: ProjectView) => (
          <button
            key={view}
            type="button"
            className={`session-header__tab${view === activeView ? ' session-header__tab--active' : ''}`}
            role="tab"
            aria-selected={view === activeView}
            onClick={(): void => {
              onShowView(view);
            }}
          >
            {VIEW_LABEL[view]}
            {view === 'changes' && changesCount !== null && changesCount > 0 && (
              <span className="session-header__tab-count">{formatCount(changesCount)}</span>
            )}
          </button>
        ))}
      </div>
      <div className="session-header__tools">
        <span className="session-header__mono" title="Laufzeit aller Sessions des Vorhabens">
          {sessionCountLabel} · {formatRuntime(totalRuntimeMs)}
        </span>
      </div>
    </header>
  );
}
