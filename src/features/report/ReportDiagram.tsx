import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { ReportFigureFrame } from '@/features/report/ReportFigureFrame';
import { entryKey } from '@/features/report/reportDigest';
import { hasDiff, mermaidView } from '@/features/report/mermaidDiff';
import {
  DIAGRAM_FAILED_TITLE,
  DIAGRAM_LOADING_TEXT,
  DIAGRAM_TAG,
  SOURCE_LABEL,
  diagramModeLabel,
} from '@/features/report/reportTexts';
import { useMermaid, type MermaidDrawing } from '@/features/report/useMermaid';
import { useVisibleOnce } from '@/features/report/useVisibleOnce';
import type { ReportFigure } from '@/lib/bindings/ReportFigure';
import { useColorSchemeVersion } from '@/lib/useColorSchemeVersion';
import { DIAGRAM_MODES, useReportStore, type DiagramMode } from '@/stores/report';
import './ReportDiagram.css';

/** Meldet der Seite, dass ein Schaubild fertig gezeichnet ist und ihre Höhe sich geändert hat. */
export const FIGURE_DRAWN_EVENT = 'report-figure-drawn';

interface ReportDiagramProps {
  /** Bereich der Phase (`scopeOf`), unter dem die gewählte Ansicht im Store liegt. */
  scope: string;
  figure: ReportFigure;
  /** Der Mermaid-Text des Schaubilds. */
  mermaid: string;
}

/** Ein Schaubild: gezeichnet erst, wenn es sichtbar wird; mit Markern in den Ansichten Unterschied, Vorher, Nachher. */
export function ReportDiagram({ scope, figure, mermaid }: ReportDiagramProps): ReactElement {
  const [isSourceShown, setIsSourceShown] = useState<boolean>(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const key: string = entryKey(scope, figure.entry);
  const mode: DiagramMode = useReportStore((state) => state.diagramModeByEntry[key] ?? 'diff');
  const setDiagramMode = useReportStore((state) => state.setDiagramMode);
  // Die Farben der Ansicht „Unterschied“ stehen im Mermaid-Text; ein neues Farbschema rendert darum neu und
  // rechnet den Text mit den neuen Token-Farben (billig genug, um ihn nicht zwischenzuspeichern).
  useColorSchemeVersion();
  const isVisible: boolean = useVisibleOnce(canvasRef);
  const isDiff: boolean = hasDiff(mermaid);
  const view: string = isDiff ? mermaidView(mermaid, mode) : mermaid;
  const drawing: MermaidDrawing = useMermaid(view, isVisible);

  useEffect(() => {
    if (drawing.kind === 'ready') {
      canvasRef.current?.dispatchEvent(new CustomEvent(FIGURE_DRAWN_EVENT, { bubbles: true }));
    }
  }, [drawing]);

  function renderActions(): ReactElement {
    return (
      <>
        {isDiff && (
          <span className="report-diagram__modes" role="group" aria-label="Ansicht">
            {DIAGRAM_MODES.map((option: DiagramMode) => (
              <button
                key={option}
                type="button"
                className="report-diagram__mode"
                aria-pressed={option === mode}
                onClick={(): void => {
                  setDiagramMode(key, option);
                }}
              >
                {diagramModeLabel(option)}
              </button>
            ))}
          </span>
        )}
        <button
          type="button"
          className="report-figure__action"
          aria-expanded={isSourceShown}
          onClick={(): void => {
            setIsSourceShown((previous: boolean) => !previous);
          }}
        >
          {SOURCE_LABEL}
        </button>
      </>
    );
  }

  function renderCanvas(): ReactElement {
    if (drawing.kind === 'ready') {
      return (
        <div className="report-diagram__svg" dangerouslySetInnerHTML={{ __html: drawing.svg }} />
      );
    }
    if (drawing.kind === 'failed') {
      return (
        <p className="report-diagram__failed">
          <b>{DIAGRAM_FAILED_TITLE}</b> {drawing.message}
        </p>
      );
    }
    return <p className="report-diagram__waiting">{DIAGRAM_LOADING_TEXT}</p>;
  }

  return (
    <ReportFigureFrame
      icon="diagram"
      caption={figure.caption}
      by={figure.by}
      tag={DIAGRAM_TAG}
      actions={renderActions()}
    >
      <div ref={canvasRef} className="report-diagram__canvas">
        {renderCanvas()}
      </div>
      {isDiff && mode === 'diff' && (
        <p className="report-diagram__legend">
          <span className="report-diagram__legend-add">neu</span>
          <span className="report-diagram__legend-chg">geändert</span>
          <span className="report-diagram__legend-del">entfällt</span>
        </p>
      )}
      {(isSourceShown || drawing.kind === 'failed') && (
        <pre className="report-diagram__source">{mermaid}</pre>
      )}
      {figure.text !== null && <p className="report-figure__text">{figure.text}</p>}
    </ReportFigureFrame>
  );
}
