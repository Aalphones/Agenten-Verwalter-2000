import { useState } from 'react';
import type { ReactElement } from 'react';
import {
  ASK_STATION_FAILED_PREFIX,
  ASK_STATION_LABEL,
  ASK_STATION_SENT_LABEL,
  ASK_STATION_TEXT,
} from '@/features/report/reportTexts';
import { sendMessage } from '@/lib/chat';
import { useActionError } from '@/lib/useActionError';
import './ReportButton.css';

interface ReportAskStationProps {
  sessionId: string;
  variant: 'secondary' | 'link';
}

/** Bittet die Station, ihre Änderungen nachträglich im Bericht zu erklären. */
export function ReportAskStation({ sessionId, variant }: ReportAskStationProps): ReactElement {
  /** Die Session, an die die Nachfrage ging oder gerade geht. */
  const [askedId, setAskedId] = useState<string | null>(null);
  const { error, run } = useActionError(sessionId);
  const isAsked: boolean = askedId === sessionId && error === null;

  function ask(): void {
    setAskedId(sessionId);
    run(() => sendMessage(sessionId, ASK_STATION_TEXT, [], []), ASK_STATION_FAILED_PREFIX);
  }

  return (
    <>
      {error !== null && <span className="report-button__error">{error}</span>}
      <button
        type="button"
        className={`report-button report-button--${variant}`}
        disabled={isAsked}
        onClick={ask}
      >
        {isAsked ? ASK_STATION_SENT_LABEL : ASK_STATION_LABEL}
      </button>
    </>
  );
}
