import type { ReactElement, ReactNode } from 'react';
import { useNow } from '@/features/background/useNow';
import { ReportAskStation } from '@/features/report/ReportAskStation';
import { ReportRetidyButton } from '@/features/report/ReportRetidyButton';
import { formatClock, minutesBetween, reportTidyState } from '@/features/report/reportTidy';
import {
  CANCEL_FAILED_PREFIX,
  CANCEL_LABEL,
  ORDER_HISTORY_LABEL,
  ORDER_LIVE_LABEL,
  RETIDY_LABEL,
  TIDY_DONE_RUNNING_TITLE,
  TIDY_EMPTY_TITLE,
  TIDY_FAILED_HINT,
  TIDY_FAILED_TITLE,
  TIDY_LIVE_FAILED_PREFIX,
  TIDY_LIVE_OPEN_TITLE,
  TIDY_LIVE_RUNNING_TITLE,
  TIDY_RUNNING_HINT,
  TIDY_UNORDERED_TITLE,
  liveOrderedTitle,
  pluralize,
} from '@/features/report/reportTexts';
import type { ReportPhase } from '@/lib/bindings/ReportPhase';
import type { ReportRepository } from '@/lib/bindings/ReportRepository';
import { cancelTidy } from '@/lib/report';
import { useActionError } from '@/lib/useActionError';
import './ReportButton.css';
import './ReportTidyState.css';

const MS_PER_SECOND = 1000;

interface BarProps {
  tone: 'running' | 'waiting';
  title: string;
  lines: readonly string[];
  isBusy?: boolean;
  /** Die Knöpfe der Leiste. */
  children?: ReactNode;
}

function Bar({ tone, title, lines, isBusy = false, children = null }: BarProps): ReactElement {
  return (
    <div className={`report-state report-state--${tone}`} role="status">
      {isBusy && <span className="report-state__spin" aria-hidden="true" />}
      <p className="report-state__text">
        <b>{title}</b>
        {lines.map((line: string) => (
          <span key={line} className="report-state__sub">
            {line}
          </span>
        ))}
      </p>
      {children !== null && <div className="report-state__actions">{children}</div>}
      {isBusy && (
        <span className="report-state__bar" aria-hidden="true">
          <i />
        </span>
      )}
    </div>
  );
}

function changedFilesText(count: number): string {
  return `${pluralize(count, 'Datei', 'Dateien')} geändert`;
}

interface ReportTidyStateProps {
  phase: ReportPhase;
}

/** Die Zustandsleiste der Phasen-Seite: ob geordnet ist, gerade geordnet wird oder nichts zu ordnen war. Eine
 *  fertige, geordnete Phase hat keine. */
export function ReportTidyState({ phase }: ReportTidyStateProps): ReactElement | null {
  const kind = reportTidyState(phase);
  const now: number = useNow(kind === 'tidying' || kind === 'liveOpen');
  const { error, run } = useActionError(phase.phaseId);
  // Eine laufende Phase hat keinen eigenen Fehlerzustand; der Grund steht unter dem Zwischenstand.
  const liveError: string[] =
    phase.tidyError === null ? [] : [`${TIDY_LIVE_FAILED_PREFIX}: ${phase.tidyError}`];

  if (kind === 'ordered') {
    return null;
  }

  if (kind === 'tidying') {
    const seconds: number = Math.max(
      0,
      Math.floor((now - (phase.tidyingSince ?? now)) / MS_PER_SECOND),
    );
    return (
      <Bar
        tone="running"
        isBusy
        title={phase.state === 'running' ? TIDY_LIVE_RUNNING_TITLE : TIDY_DONE_RUNNING_TITLE}
        lines={[
          `seit ${String(seconds)} s · ${TIDY_RUNNING_HINT}`,
          ...(error === null ? [] : [error]),
        ]}
      >
        <button
          type="button"
          className="report-button"
          onClick={(): void => {
            run(() => cancelTidy(phase.phaseId), CANCEL_FAILED_PREFIX);
          }}
        >
          {CANCEL_LABEL}
        </button>
      </Bar>
    );
  }

  if (kind === 'liveOpen') {
    const files: number = phase.repositories.reduce(
      (sum: number, repository: ReportRepository) => sum + repository.files,
      0,
    );
    const startedAt: number | null = phase.way[0]?.at ?? null;
    const runtime: string =
      startedAt === null ? '' : ` seit ${String(minutesBetween(startedAt, now))} min`;
    return (
      <Bar
        tone="running"
        title={TIDY_LIVE_OPEN_TITLE}
        lines={[
          `${phase.stationLabel} arbeitet${runtime} · bisher ${changedFilesText(files)}, ${pluralize(phase.entries, 'Erklärung', 'Erklärungen')} · Haiku ordnet automatisch am Phasenende`,
          ...liveError,
        ]}
      >
        <ReportRetidyButton phase={phase} label={ORDER_LIVE_LABEL} variant="primary" />
      </Bar>
    );
  }

  if (kind === 'liveOrdered') {
    const hasNews: boolean = phase.filesSince + phase.entriesSince > 0;
    const news: string = hasNews
      ? `seitdem ${changedFilesText(phase.filesSince)}, ${pluralize(phase.entriesSince, 'neue Erklärung', 'neue Erklärungen')}`
      : 'seitdem nichts Neues';
    return (
      <Bar
        tone="running"
        title={liveOrderedTitle(formatClock(phase.tidiedAt ?? 0))}
        lines={[
          `Station arbeitet weiter · ${news} · am Phasenende ordnet Haiku erneut`,
          ...liveError,
        ]}
      >
        {hasNews || phase.tidyError !== null ? (
          <ReportRetidyButton phase={phase} label={RETIDY_LABEL} variant="secondary" />
        ) : null}
      </Bar>
    );
  }

  if (kind === 'failed') {
    return (
      <Bar
        tone="waiting"
        title={TIDY_FAILED_TITLE}
        lines={[`${phase.tidyError ?? ''} · ${TIDY_FAILED_HINT}`]}
      >
        <ReportRetidyButton phase={phase} label={RETIDY_LABEL} variant="secondary" />
      </Bar>
    );
  }

  // Ohne Ordnung kann es trotzdem Einträge geben (Ordnung abgebrochen): dann behauptet die Leiste nicht „0“.
  const hasEntries: boolean = phase.entries > 0;
  const written: string = hasEntries
    ? `${phase.stationLabel} hat ${pluralize(phase.entries, 'Eintrag', 'Einträge')} in den Bericht geschrieben`
    : `${phase.stationLabel} hat 0 Einträge in den Bericht geschrieben · Haiku hatte nichts zu ordnen`;
  return (
    <Bar
      tone="waiting"
      title={hasEntries ? TIDY_UNORDERED_TITLE : TIDY_EMPTY_TITLE}
      lines={[written]}
    >
      {phase.stationSessionId !== null && (
        <ReportAskStation sessionId={phase.stationSessionId} variant="secondary" />
      )}
      <ReportRetidyButton phase={phase} label={ORDER_HISTORY_LABEL} variant="primary" />
    </Bar>
  );
}
