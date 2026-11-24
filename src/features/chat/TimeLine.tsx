import type { ReactElement } from 'react';
import type { TimeSeparator } from '@/features/chat/timeMarks';
import './TimeLine.css';

interface TimeLineProps {
  separator: TimeSeparator;
}

/** Linie mit Wort zwischen zwei Blöcken: Tageswechsel (durchgezogen) oder lange Pause (gestrichelt). */
export function TimeLine({ separator }: TimeLineProps): ReactElement {
  return (
    <div className={`time-line time-line--${separator.kind}`} role="separator">
      <span className="time-line__label">{separator.label}</span>
    </div>
  );
}
