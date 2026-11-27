import { useState } from 'react';
import type { ReactElement } from 'react';
import {
  RETIDY_FINISHED_CONFIRM,
  RETIDY_HINT_TITLE,
  RETIDY_LABEL,
} from '@/features/report/reportTexts';
import { retidyReport } from '@/lib/report';
import { useActionError } from '@/lib/useActionError';
import './ReportTidyHint.css';

const CANCEL_LABEL = 'Abbrechen';
const CONFIRM_LABEL = 'Trotzdem neu ordnen';
const RETIDY_FAILED = 'Neu ordnen fehlgeschlagen';

interface ReportTidyHintProps {
  phaseId: string;
  /** Der Fehler der letzten Ordnung. */
  message: string;
  /** Hat die Phase Prüfwerte, liest das Neuordnen sie neu und kann sie überschreiben: erst bestätigen lassen. */
  needsConfirm: boolean;
}

/** Hinweis zu einer fehlgeschlagenen Ordnung mit dem Knopf „Neu ordnen“. */
export function ReportTidyHint({
  phaseId,
  message,
  needsConfirm,
}: ReportTidyHintProps): ReactElement {
  const [isConfirming, setIsConfirming] = useState<boolean>(false);
  const { error, run } = useActionError(phaseId);

  function retidy(): void {
    setIsConfirming(false);
    run(() => retidyReport(phaseId), RETIDY_FAILED);
  }

  function handleClick(): void {
    if (needsConfirm) {
      setIsConfirming(true);
      return;
    }
    retidy();
  }

  return (
    <div className="report-tidy" role="status">
      <p className="report-tidy__text">
        <b>{RETIDY_HINT_TITLE}</b> <span>{message}</span>
      </p>
      {isConfirming && <p className="report-tidy__confirm">{RETIDY_FINISHED_CONFIRM}</p>}
      {error !== null && <p className="report-tidy__error">{error}</p>}
      <div className="report-tidy__actions">
        {isConfirming && (
          <button
            type="button"
            className="report-tidy__button"
            onClick={(): void => {
              setIsConfirming(false);
            }}
          >
            {CANCEL_LABEL}
          </button>
        )}
        <button
          type="button"
          className="report-tidy__button"
          onClick={isConfirming ? retidy : handleClick}
        >
          {isConfirming ? CONFIRM_LABEL : RETIDY_LABEL}
        </button>
      </div>
    </div>
  );
}
