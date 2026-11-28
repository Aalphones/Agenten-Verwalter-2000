import { useState } from 'react';
import type { ReactElement } from 'react';
import {
  CANCEL_LABEL,
  RETIDY_CONFIRM_LABEL,
  RETIDY_FAILED_PREFIX,
  RETIDY_FINISHED_CONFIRM,
} from '@/features/report/reportTexts';
import type { ReportPhase } from '@/lib/bindings/ReportPhase';
import { retidyReport } from '@/lib/report';
import { useActionError } from '@/lib/useActionError';
import './ReportButton.css';

interface ReportRetidyButtonProps {
  phase: ReportPhase;
  label: string;
  variant: 'primary' | 'secondary' | 'link';
}

/** Lässt Haiku die Phase ordnen. Hat eine fertige Phase Prüfwerte, liest das Ordnen sie neu und kann sie
 *  überschreiben: dann erst bestätigen lassen. */
export function ReportRetidyButton({
  phase,
  label,
  variant,
}: ReportRetidyButtonProps): ReactElement {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const { error, run } = useActionError(phase.phaseId);
  const isConfirming: boolean = confirmingId === phase.phaseId;
  const needsConfirm: boolean = phase.state === 'done' && phase.checks !== null;

  function handleClick(): void {
    if (needsConfirm && !isConfirming) {
      setConfirmingId(phase.phaseId);
      return;
    }
    setConfirmingId(null);
    run(() => retidyReport(phase.phaseId), RETIDY_FAILED_PREFIX);
  }

  return (
    <>
      {isConfirming && <span className="report-button__note">{RETIDY_FINISHED_CONFIRM}</span>}
      {error !== null && <span className="report-button__error">{error}</span>}
      {isConfirming && (
        <button
          type="button"
          className="report-button"
          onClick={(): void => {
            setConfirmingId(null);
          }}
        >
          {CANCEL_LABEL}
        </button>
      )}
      <button
        type="button"
        className={`report-button report-button--${isConfirming ? 'secondary' : variant}`}
        onClick={handleClick}
      >
        {isConfirming ? RETIDY_CONFIRM_LABEL : label}
      </button>
    </>
  );
}
