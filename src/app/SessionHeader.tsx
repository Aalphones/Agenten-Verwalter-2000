import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { StatusIcon } from '@/components/StatusIcon';
import { formatCount } from '@/features/changes/changesScope';
import { STATUS_LABEL } from '@/features/sessions/sessionStatus';
import type { SessionSummary } from '@/lib/bindings/SessionSummary';
import { cancelSession, pauseSession, resumeSession } from '@/lib/sessions';
import { SESSION_VIEWS, type SessionView } from '@/stores/sessions';
import './SessionHeader.css';

const CONTEXT_WARNING_PERCENT = 90;
const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;

const VIEW_LABEL: Record<SessionView, string> = { chat: 'Chat', changes: 'Changes' };

interface SessionHeaderProps {
  session: SessionSummary;
  activeView: SessionView;
  /** Dateien unter „Alle“; `null`, solange die Changes nicht gelesen sind. */
  changesCount: number | null;
  onShowView: (view: SessionView) => void;
}

export function SessionHeader({
  session,
  activeView,
  changesCount,
  onShowView,
}: SessionHeaderProps): ReactElement {
  const [now, setNow] = useState<number>(() => Date.now());
  const isTicking: boolean = session.runningSince !== null;

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

  const runningMs: number =
    session.runningSince === null
      ? session.runningMs
      : session.runningMs + Math.max(0, now - session.runningSince);
  const contextPercent: number =
    session.contextWindow === 0
      ? 0
      : Math.round((session.contextUsed / session.contextWindow) * 100);
  // „Changes“ gibt es nur mit mindestens einem Repository.
  const views: readonly SessionView[] = session.repositoryCount > 0 ? SESSION_VIEWS : ['chat'];
  const usedThousands: number = Math.round(session.contextUsed / 1000);
  const windowThousands: number = Math.round(session.contextWindow / 1000);
  const contextClass = `session-header__context-fill${
    contextPercent >= CONTEXT_WARNING_PERCENT ? ' session-header__context-fill--warning' : ''
  }`;

  function runAction(action: (sessionId: string) => Promise<void>): void {
    action(session.id).catch((reason: unknown) => {
      console.error('Session-Aktion fehlgeschlagen', reason);
    });
  }

  function renderControls(): ReactElement | null {
    switch (session.status) {
      case 'starting':
      case 'running':
      case 'waiting':
        return (
          <div className="session-header__controls">
            <button
              type="button"
              className="session-header__button"
              onClick={(): void => {
                runAction(pauseSession);
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                <rect x="2.8" y="2.2" width="2.2" height="7.6" rx="0.6" fill="currentColor" />
                <rect x="7" y="2.2" width="2.2" height="7.6" rx="0.6" fill="currentColor" />
              </svg>
              Pause
            </button>
            <button
              type="button"
              className="session-header__button"
              onClick={(): void => {
                runAction(cancelSession);
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                <rect x="2.5" y="2.5" width="7" height="7" rx="1.2" fill="currentColor" />
              </svg>
              Abbrechen
            </button>
          </div>
        );
      case 'paused':
        return (
          <button
            type="button"
            className="session-header__button session-header__button--accent"
            onClick={(): void => {
              runAction(resumeSession);
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M3.5 2.2v7.6L10 6Z" fill="currentColor" />
            </svg>
            Fortsetzen
          </button>
        );
      case 'completed':
      case 'cancelled':
      case 'error':
        return null;
    }
  }

  return (
    <header className="session-header">
      <div className="session-header__title">
        <h1 className="session-header__name">{session.name}</h1>
        <span className={`session-header__status session-header__status--${session.status}`}>
          <StatusIcon status={session.status} size={10} />
          <span>{STATUS_LABEL[session.status]}</span>
        </span>
      </div>
      <div className="session-header__tabs" role="tablist" aria-label="Ansicht">
        {views.map((view: SessionView) => (
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
        <span
          className="session-header__context"
          title={`Kontext: ${String(usedThousands)}k von ${String(windowThousands)}k Tokens belegt`}
        >
          <span className="session-header__context-bar">
            <span
              className={contextClass}
              style={{ width: `${String(Math.min(contextPercent, 100))}%` }}
            />
          </span>
          <span className="session-header__mono">
            {String(usedThousands)}k / {String(windowThousands)}k
          </span>
        </span>
        <span className="session-header__runtime session-header__mono" title="Laufzeit der Session">
          <svg
            width="12"
            height="12"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="7" cy="7" r="5.5" />
            <path d="M7 4v3.2l2 1.3" />
          </svg>
          {formatRuntime(runningMs)}
        </span>
        {renderControls()}
      </div>
    </header>
  );
}

function formatRuntime(milliseconds: number): string {
  const totalSeconds: number = Math.floor(milliseconds / MS_PER_SECOND);
  const hours: number = Math.floor(totalSeconds / SECONDS_PER_HOUR);
  const minutes: number = Math.floor((totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const seconds: number = totalSeconds % SECONDS_PER_MINUTE;
  const paddedSeconds: string = String(seconds).padStart(2, '0');
  if (hours > 0) {
    return `${String(hours)}:${String(minutes).padStart(2, '0')}:${paddedSeconds}`;
  }
  return `${String(minutes)}:${paddedSeconds}`;
}
