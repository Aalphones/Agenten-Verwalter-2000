import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { SessionGauge } from '@/app/SessionGauge';
import { Popover } from '@/components/Popover';
import { StatusIcon } from '@/components/StatusIcon';
import { formatCount } from '@/features/changes/changesScope';
import { GitBranchPill } from '@/features/git/GitBranchPill';
import { PencilIcon } from '@/features/notes/PencilIcon';
import { useNow } from '@/features/background/useNow';
import { useSideQuestions } from '@/features/side/useSideQuestions';
import { FRESH_TITLE, TIDYING_TAB_TITLE } from '@/features/report/reportTexts';
import { activeRun, headerStatus, headerStatusLabel } from '@/features/sessions/sessionStatus';
import type { GitSessionStatus } from '@/lib/bindings/GitSessionStatus';
import type { NotePlacement } from '@/lib/bindings/NotePlacement';
import type { SessionChanges } from '@/lib/bindings/SessionChanges';
import type { SessionSummary } from '@/lib/bindings/SessionSummary';
import { commandErrorText } from '@/lib/errors';
import { cancelSession, pauseSession, resumeSession } from '@/lib/sessions';
import { useReviewStore } from '@/stores/review';
import { useSessionErrorsStore } from '@/stores/sessionErrors';
import { useSettingsStore } from '@/stores/settings';
import { SESSION_VIEWS, type SessionView } from '@/stores/sessions';
import './SessionHeader.css';

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;

const SIDE_LABEL = 'Nebenfragen';
const SIDE_TITLE = 'Nebenfragen dieser Session — Strg+; stellt eine neue';

const MORE_MENU_WIDTH = 200;

const VIEW_LABEL: Record<SessionView, string> = {
  review: 'Review',
  chat: 'Chat',
  files: 'Dateien',
  artifacts: 'Artefakte',
  note: 'Notiz',
};

interface SessionHeaderProps {
  session: SessionSummary;
  projectName: string;
  activeView: SessionView;
  /** Geänderte Dateien des ganzen Vorhabens für „Dateien“; `null`, solange nicht gelesen. */
  filesCount: number | null;
  /** Für die Branch-Pille: Namen und eigene uncommittete Dateien; `null`, solange nicht gelesen. */
  changes: SessionChanges | null;
  /** Git-Zustand der Session; `null`, solange nicht gelesen. */
  gitStatus: GitSessionStatus | null;
  /** Artefakte des Vorhabens; „Artefakte“ erscheint erst ab dem ersten. */
  artifactCount: number;
  /** Ohne Repository erscheint „Dateien“ nur mit Session-Dateien. */
  hasSessionFiles: boolean;
  /** Der Bericht der Umsetzung hat Inhalt: „Review“ erscheint (nur bei Stations-Sessions). */
  hasReport: boolean;
  /** Eine Phase ist fertig, seit der Bericht zuletzt offen war: Punkt am Reiter. */
  hasFreshReport: boolean;
  /** Haiku ordnet gerade eine Phase des Berichts: blauer Punkt am Reiter. */
  isReportTidying: boolean;
  isBackgroundOpen: boolean;
  onToggleBackground: () => void;
  /** Laufende Terminals des Vorhabens. */
  terminalCount: number;
  isTerminalOpen: boolean;
  onToggleTerminal: () => void;
  onShowView: (view: SessionView) => void;
  onOpenProject: () => void;
}

export function SessionHeader({
  session,
  projectName,
  activeView,
  filesCount,
  changes,
  gitStatus,
  artifactCount,
  hasSessionFiles,
  hasReport,
  hasFreshReport,
  isReportTidying,
  isBackgroundOpen,
  onToggleBackground,
  terminalCount,
  isTerminalOpen,
  onToggleTerminal,
  onShowView,
  onOpenProject,
}: SessionHeaderProps): ReactElement {
  const [now, setNow] = useState<number>(() => Date.now());
  const [isMoreOpen, setIsMoreOpen] = useState<boolean>(false);
  const reportSessionError = useSessionErrorsStore((state) => state.report);
  const clearSessionError = useSessionErrorsStore((state) => state.clear);
  const reviewCount: number = useReviewStore((state) => state.collected[session.id]?.length ?? 0);
  const scriptNow: number = useNow(
    session.awaitedScript !== null || session.runningCommand !== null,
  );
  const sideQuestionCount: number = useSideQuestions(session.id).questions.length;
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
  const notePlacement: NotePlacement = useSettingsStore(
    (state) => state.settings?.notePlacement ?? 'dock',
  );
  // „Dateien“ gibt es nur mit Repository oder Session-Datei, „Artefakte“ nur mit mindestens einem Artefakt,
  // „Notiz“ nur mit der Einstellung „Als Reiter oben“.
  const views: readonly SessionView[] = SESSION_VIEWS.filter(
    (view: SessionView) =>
      view === 'chat' ||
      (view === 'review' && hasReport) ||
      (view === 'files' && (session.repositoryCount > 0 || hasSessionFiles)) ||
      (view === 'artifacts' && artifactCount > 0) ||
      (view === 'note' && notePlacement === 'tab'),
  );

  const reviewTitle: string | undefined =
    reviewCount === 0
      ? undefined
      : `${formatCount(reviewCount)} ${reviewCount === 1 ? 'Kommentar wartet' : 'Kommentare warten'} im Chat`;

  const statusLabel: string = headerStatusLabel(session, scriptNow);

  function runAction(action: (sessionId: string) => Promise<void>): void {
    action(session.id)
      .then(() => {
        clearSessionError(session.id);
      })
      .catch((reason: unknown) => {
        console.error('Session-Aktion fehlgeschlagen', reason);
        reportSessionError(session.id, `Aktion fehlgeschlagen: ${commandErrorText(reason)}`);
      });
  }

  function renderMoreMenu(): ReactElement {
    return (
      <div className="session-header__anchor">
        <button
          type="button"
          className="session-header__button session-header__button--icon"
          aria-expanded={isMoreOpen}
          aria-label="Weitere Aktionen"
          title="Weitere Aktionen"
          onClick={(): void => {
            setIsMoreOpen((current: boolean) => !current);
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <circle cx="2.2" cy="6" r="1.1" fill="currentColor" />
            <circle cx="6" cy="6" r="1.1" fill="currentColor" />
            <circle cx="9.8" cy="6" r="1.1" fill="currentColor" />
          </svg>
        </button>
        {isMoreOpen && (
          <Popover
            label="Weitere Aktionen"
            placement="below"
            align="end"
            width={MORE_MENU_WIDTH}
            onClose={(): void => {
              setIsMoreOpen(false);
            }}
          >
            <button
              type="button"
              className="session-header__menu-item session-header__menu-item--danger"
              onClick={(): void => {
                setIsMoreOpen(false);
                runAction(cancelSession);
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                <rect x="2.5" y="2.5" width="7" height="7" rx="1.2" fill="currentColor" />
              </svg>
              Session abbrechen
            </button>
          </Popover>
        )}
      </div>
    );
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
              className="session-header__button session-header__button--icon"
              aria-label="Pause"
              title="Pause"
              onClick={(): void => {
                runAction(pauseSession);
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                <rect x="2.8" y="2.2" width="2.2" height="7.6" rx="0.6" fill="currentColor" />
                <rect x="7" y="2.2" width="2.2" height="7.6" rx="0.6" fill="currentColor" />
              </svg>
            </button>
            {renderMoreMenu()}
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
      case 'new':
        return null;
    }
  }

  return (
    <header className="session-header">
      <div className="session-header__title">
        <button
          type="button"
          className="session-header__project"
          title="Übersicht des Vorhabens öffnen"
          onClick={onOpenProject}
        >
          {projectName}
        </button>
        <svg
          className="session-header__crumb"
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
        <span className="session-header__number">#{session.number}</span>
        <h1 className="session-header__name">{session.name}</h1>
        <span
          className={`session-header__status session-header__status--${headerStatus(session)}`}
          title={activeRun(session)?.target ?? statusLabel}
        >
          <StatusIcon status={headerStatus(session)} size={10} />
          <span className="session-header__status-label">{statusLabel}</span>
        </span>
        <GitBranchPill
          status={gitStatus}
          changes={changes}
          onOpenChanges={(): void => {
            onShowView('files');
          }}
        />
      </div>
      <div className="session-header__tabs" role="tablist" aria-label="Ansicht">
        {views.map((view: SessionView) => (
          <button
            key={view}
            type="button"
            className={`session-header__tab${view === activeView ? ' session-header__tab--active' : ''}`}
            role="tab"
            aria-selected={view === activeView}
            title={view === 'chat' ? reviewTitle : undefined}
            onClick={(): void => {
              onShowView(view);
            }}
          >
            {view === 'note' && <PencilIcon />}
            {VIEW_LABEL[view]}
            {view === 'chat' && reviewCount > 0 && (
              <span className="session-header__tab-count session-header__tab-count--review">
                {formatCount(reviewCount)}
              </span>
            )}
            {view === 'review' && isReportTidying && (
              <span
                className="session-header__tab-dot session-header__tab-dot--tidying"
                title={TIDYING_TAB_TITLE}
              />
            )}
            {view === 'review' && !isReportTidying && hasFreshReport && view !== activeView && (
              <span className="session-header__tab-dot" title={FRESH_TITLE} />
            )}
            {view === 'files' && filesCount !== null && filesCount > 0 && (
              <span className="session-header__tab-count">{formatCount(filesCount)}</span>
            )}
            {view === 'artifacts' && (
              <span className="session-header__tab-count">{formatCount(artifactCount)}</span>
            )}
          </button>
        ))}
      </div>
      <div className="session-header__tools">
        <button
          type="button"
          className={`session-header__background${isTerminalOpen ? ' session-header__background--active' : ''}`}
          aria-pressed={isTerminalOpen}
          aria-label="Terminal ein-/ausblenden"
          title="Terminal ein-/ausblenden (Strg+Ö)"
          onClick={onToggleTerminal}
        >
          <span className="session-header__mono">&gt;_</span>
          {terminalCount > 0 && (
            <span className="session-header__background-count">{String(terminalCount)}</span>
          )}
        </button>
        <button
          type="button"
          className={`session-header__background${isBackgroundOpen ? ' session-header__background--active' : ''}`}
          aria-pressed={isBackgroundOpen}
          aria-label={
            sideQuestionCount > 0 ? `${SIDE_LABEL}: ${String(sideQuestionCount)}` : SIDE_LABEL
          }
          title={SIDE_TITLE}
          onClick={onToggleBackground}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="7" cy="7" r="5.5" />
            <path d="M5.3 5.4a1.8 1.8 0 1 1 2.5 1.6c-.5.3-.8.6-.8 1.2v.3" />
            <circle cx="7" cy="10.3" r=".7" fill="currentColor" stroke="none" />
          </svg>
          <span className="session-header__background-label">{SIDE_LABEL}</span>
          {sideQuestionCount > 0 && (
            <span className="session-header__background-count">{String(sideQuestionCount)}</span>
          )}
        </button>
        <SessionGauge session={session} runtime={formatRuntime(runningMs)} />
        {renderControls()}
      </div>
    </header>
  );
}

export function formatRuntime(milliseconds: number): string {
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
