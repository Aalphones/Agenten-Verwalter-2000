import type { ReactElement, ReactNode } from 'react';
import { ReportIcon, type ReportIconName } from '@/features/report/ReportIcon';
import './ReportFigureFrame.css';

interface ReportFigureFrameProps {
  icon: ReportIconName;
  caption: string;
  by: string;
  /** Kleine Marke hinter der Unterschrift, etwa „Mermaid“. */
  tag?: string;
  /** Schalter und Knöpfe rechts in der Kopfzeile. */
  actions?: ReactNode;
  children: ReactNode;
}

/** Rahmen mit Unterschrift für ein Bild oder Schaubild des Berichts; den Inhalt liefern `ReportDiagram` und
 *  `ReportFigureBlock`. */
export function ReportFigureFrame({
  icon,
  caption,
  by,
  tag,
  actions,
  children,
}: ReportFigureFrameProps): ReactElement {
  return (
    <figure className="report-figure">
      <figcaption className="report-figure__head">
        <ReportIcon name={icon} />
        <span className="report-figure__caption">{caption}</span>
        {tag !== undefined && <span className="report-figure__tag">{tag}</span>}
        <span className="report-figure__by">{by}</span>
        <span className="report-figure__actions">{actions}</span>
      </figcaption>
      {children}
    </figure>
  );
}
