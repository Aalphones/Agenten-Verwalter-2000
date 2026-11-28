import type { ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { CLOSE_LABEL, NOTICE_SHOW_LABEL } from '@/features/report/reportTexts';
import './ReportTidyToast.css';

interface ReportTidyToastProps {
  text: string;
  onShow: () => void;
  onClose: () => void;
}

/** Der Hinweis unten rechts, wenn Haiku eine Phase geordnet hat. */
export function ReportTidyToast({ text, onShow, onClose }: ReportTidyToastProps): ReactElement {
  // Im `body`: der Bericht ist ein Container, in dem `position: fixed` an ihm statt am Fenster hängt.
  return createPortal(
    <div className="report-notice" role="status">
      <span>{text}</span>
      <button type="button" className="report-notice__button" onClick={onShow}>
        {NOTICE_SHOW_LABEL}
      </button>
      <button
        type="button"
        className="report-notice__button report-notice__button--close"
        aria-label={CLOSE_LABEL}
        onClick={onClose}
      >
        ✕
      </button>
    </div>,
    document.body,
  );
}
