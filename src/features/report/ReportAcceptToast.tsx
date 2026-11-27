import type { ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { ACCEPT_TOAST_TEXT, ACCEPT_UNDO_LABEL } from '@/features/report/reportTexts';
import './ReportAcceptToast.css';

interface ReportAcceptToastProps {
  onUndo: () => void;
}

/** Der Hinweis nach „Abnehmen“: gilt, bis die Schonfrist abläuft; „Rückgängig“ nimmt die Abnahme zurück. */
export function ReportAcceptToast({ onUndo }: ReportAcceptToastProps): ReactElement {
  // Im `body`: der Bericht ist ein Container, in dem `position: fixed` an ihm statt am Fenster hängt.
  return createPortal(
    <div className="report-toast" role="status">
      <span>{ACCEPT_TOAST_TEXT}</span>
      <button type="button" className="report-toast__undo" onClick={onUndo}>
        {ACCEPT_UNDO_LABEL}
      </button>
    </div>,
    document.body,
  );
}
