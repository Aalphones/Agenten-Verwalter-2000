import type { ReactElement } from 'react';
import { ReportIcon } from '@/features/report/ReportIcon';
import {
  FRESH_TITLE,
  NOT_STARTED_TITLE,
  OVERVIEW_TITLE,
  RUNNING_TITLE,
  TOC_LABEL,
} from '@/features/report/reportTexts';
import type { ReportPhase } from '@/lib/bindings/ReportPhase';
import type { ReportView } from '@/lib/bindings/ReportView';
import { useReportStore } from '@/stores/report';
import './ReportToc.css';

/** Ein fester Wert, damit der Selektor ohne Eintrag dieselbe Referenz liefert und nicht neu zeichnet. */
const NOTHING_VISITED: readonly string[] = [];

interface ReportTocProps {
  report: ReportView;
  implementationId: string;
  /** Schlüssel der offenen Phasen-Seite; `null` ist der Überblick. */
  currentPage: string | null;
  onShowPage: (key: string | null) => void;
}

/** Inhaltsverzeichnis: „Überblick“ und genau eine Zeile je Phase. */
export function ReportToc({
  report,
  implementationId,
  currentPage,
  onShowPage,
}: ReportTocProps): ReactElement {
  const visited: readonly string[] = useReportStore(
    (state) => state.visitedByImplementation[implementationId] ?? NOTHING_VISITED,
  );

  function renderPhase(phase: ReportPhase): ReactElement {
    const inner: ReactElement = (
      <>
        <span className="report-toc__key">{phase.key}</span>
        <span className="report-toc__name">{phase.title}</span>
      </>
    );
    if (phase.state === 'notStarted') {
      return (
        <li key={phase.phaseId}>
          <span className="report-toc__link report-toc__link--off" title={NOT_STARTED_TITLE}>
            {inner}
          </span>
        </li>
      );
    }
    const isCurrent: boolean = currentPage === phase.key;
    const isFresh: boolean =
      phase.state === 'done' && !isCurrent && !visited.includes(phase.phaseId);
    return (
      <li key={phase.phaseId}>
        <button
          type="button"
          className={`report-toc__link${isCurrent ? ' report-toc__link--current' : ''}`}
          aria-current={isCurrent ? 'page' : undefined}
          onClick={(): void => {
            onShowPage(phase.key);
          }}
        >
          {inner}
          {phase.state === 'running' && (
            <span className="report-toc__dot report-toc__dot--running" title={RUNNING_TITLE} />
          )}
          {isFresh && <span className="report-toc__dot" title={FRESH_TITLE} />}
        </button>
      </li>
    );
  }

  return (
    <nav className="report-toc" aria-label={TOC_LABEL}>
      <ol className="report-toc__list">
        <li>
          <button
            type="button"
            className={`report-toc__link${currentPage === null ? ' report-toc__link--current' : ''}`}
            aria-current={currentPage === null ? 'page' : undefined}
            onClick={(): void => {
              onShowPage(null);
            }}
          >
            <ReportIcon name="map" />
            <span className="report-toc__name">{OVERVIEW_TITLE}</span>
          </button>
        </li>
        {report.phases.map(renderPhase)}
      </ol>
    </nav>
  );
}
