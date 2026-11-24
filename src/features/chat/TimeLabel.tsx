import type { ReactElement } from 'react';
import { formatClock, formatTooltip } from '@/features/chat/timeMarks';
import './TimeLabel.css';

interface TimeLabelProps {
  at: number;
  /** Die Nachricht des Nutzers sitzt tiefer als die übrigen Blöcke. */
  isUser: boolean;
}

/** Die Uhrzeit am Rand eines Blocks; der Tooltip nennt Wochentag, Datum und Sekunden. */
export function TimeLabel({ at, isUser }: TimeLabelProps): ReactElement {
  return (
    <time
      className={isUser ? 'time-label time-label--user' : 'time-label'}
      dateTime={new Date(at).toISOString()}
      title={formatTooltip(at)}
    >
      {formatClock(at)}
    </time>
  );
}
