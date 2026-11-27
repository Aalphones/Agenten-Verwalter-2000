import type { ReactElement } from 'react';
import { ReportIcon } from '@/features/report/ReportIcon';
import { FIGURE_PLACEHOLDER } from '@/features/report/reportTexts';
import type { ReportFigure } from '@/lib/bindings/ReportFigure';
import './ReportFigureFrame.css';

interface ReportFigureFrameProps {
  figure: ReportFigure;
  /** Ersetzt den Standardtext des Platzhalters, etwa für das Schaubild der Review. */
  placeholder?: string;
}

/** Rahmen mit Unterschrift für ein Bild oder Schaubild des Berichts; Bild und Schaubild selbst zeichnet die
 *  spätere Phase in diesen Rahmen. */
export function ReportFigureFrame({ figure, placeholder }: ReportFigureFrameProps): ReactElement {
  return (
    <figure className="report-figure">
      <figcaption className="report-figure__head">
        <ReportIcon name="image" />
        <span>{figure.caption}</span>
        <span className="report-figure__by">{figure.by}</span>
      </figcaption>
      <div className="report-figure__body">
        {figure.text !== null && <p className="report-figure__text">{figure.text}</p>}
        <p className="report-figure__placeholder">{placeholder ?? FIGURE_PLACEHOLDER}</p>
      </div>
    </figure>
  );
}
