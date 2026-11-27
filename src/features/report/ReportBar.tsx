import type { ReactElement } from 'react';
import type { BarState } from '@/features/report/reportDigest';
import { REPORT_TITLE, TOC_BUTTON_LABEL } from '@/features/report/reportTexts';
import './ReportBar.css';

interface ReportBarProps {
  state: BarState;
  meta: string;
  onOpenToc: () => void;
}

/** Leiste über dem ganzen Bericht: Titel, Zustand, eine Zeile Stand; der Knopf „Inhalt“ erscheint nur schmal. */
export function ReportBar({ state, meta, onOpenToc }: ReportBarProps): ReactElement {
  return (
    <header className="report-bar">
      <div className="report-bar__title">
        <b>{REPORT_TITLE}</b>
        <span className={`report-bar__state report-bar__state--${state.tone}`}>
          <i className="report-bar__state-dot" />
          {state.label}
        </span>
        <small className="report-bar__meta">{meta}</small>
      </div>
      <button type="button" className="report-bar__toc" onClick={onOpenToc}>
        {TOC_BUTTON_LABEL}
      </button>
    </header>
  );
}
