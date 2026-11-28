import type { ReactElement } from 'react';
import { ReportAskStation } from '@/features/report/ReportAskStation';
import { formatClock } from '@/features/report/reportTidy';
import {
  HAIKU_FROM_ENTRIES,
  HAIKU_FROM_HISTORY,
  HAIKU_NAME,
  STATION_RESULT_TITLE,
  STATION_RESULT_UNORDERED,
} from '@/features/report/reportTexts';
import type { ReportPhase } from '@/lib/bindings/ReportPhase';
import './ReportResult.css';

interface ReportResultProps {
  phase: ReportPhase;
}

/** Der Ergebnis-Text der Phase mit seiner Herkunft: von Haiku geordnet oder die ungeordnete Meldung der Station. */
export function ReportResult({ phase }: ReportResultProps): ReactElement | null {
  const isRunning: boolean = phase.state === 'running';

  if (!phase.ordered) {
    if (isRunning || phase.stationResult === null) {
      return null;
    }
    return (
      <>
        <p className="report-result__origin">
          <b>{STATION_RESULT_TITLE}</b>
          <span>· {STATION_RESULT_UNORDERED}</span>
        </p>
        <p className="report-result__lead report-result__lead--quiet">{phase.stationResult}</p>
      </>
    );
  }

  function sourceText(): string {
    if (isRunning) {
      return `Zwischenstand von ${formatClock(phase.tidiedAt ?? 0)}`;
    }
    return phase.entries === 0 ? HAIKU_FROM_HISTORY : HAIKU_FROM_ENTRIES;
  }

  return (
    <>
      <p className="report-result__origin">
        <b>{HAIKU_NAME}</b>
        <span>· {sourceText()}</span>
        {!isRunning && phase.entries === 0 && phase.stationSessionId !== null && (
          <ReportAskStation sessionId={phase.stationSessionId} variant="link" />
        )}
      </p>
      <p className="report-result__lead">{phase.result}</p>
      {!isRunning && phase.stationResult !== null && (
        <p className="report-result__station">
          {STATION_RESULT_TITLE}: {phase.stationResult}
        </p>
      )}
    </>
  );
}
