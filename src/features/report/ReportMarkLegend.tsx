import type { ReactElement } from 'react';
import type { ReportMark } from '@/lib/bindings/ReportMark';
import './ReportMarkLegend.css';

interface ReportMarkLegendProps {
  marks: readonly ReportMark[];
  hotMark: number | null;
  onHotMark: (mark: number | null) => void;
}

/** Die Texte der Marken eines Bildes, je Zeile Nummer und Satz; Marken ohne Text haben keine Zeile. */
export function ReportMarkLegend({
  marks,
  hotMark,
  onHotMark,
}: ReportMarkLegendProps): ReactElement | null {
  const described: ReportMark[] = marks.filter((mark: ReportMark) => mark.text !== null);
  if (described.length === 0) {
    return null;
  }
  return (
    <ul className="report-legend">
      {described.map((mark: ReportMark) => (
        <li
          key={mark.n}
          className={`report-legend__item${hotMark === mark.n ? ' report-legend__item--hot' : ''}`}
          onMouseEnter={(): void => {
            onHotMark(mark.n);
          }}
          onMouseLeave={(): void => {
            onHotMark(null);
          }}
        >
          <span className="report-legend__number">{mark.n}</span>
          <span>{mark.text}</span>
        </li>
      ))}
    </ul>
  );
}
