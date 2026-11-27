import type { MouseEvent, ReactElement } from 'react';
import { ReportIcon } from '@/features/report/ReportIcon';
import { COMMENT_LABEL } from '@/features/report/reportTexts';
import './ReportCommentButton.css';

interface ReportCommentButtonProps {
  /** Der Knopf selbst ist die Stelle, an der das Kommentarfeld hängt. */
  onComment: (anchor: Element) => void;
  label?: string;
  ariaLabel?: string;
  /** Für einen Schalter: ob er gerade gedrückt (eingeschaltet) ist. */
  isPressed?: boolean;
}

/** Der Knopf „Kommentar“ an einem Stopp, Schaubild, Bildschirm oder Bild. */
export function ReportCommentButton({
  onComment,
  label = COMMENT_LABEL,
  ariaLabel,
  isPressed,
}: ReportCommentButtonProps): ReactElement {
  return (
    <button
      type="button"
      className="report-comment-button"
      aria-label={ariaLabel}
      aria-pressed={isPressed}
      onClick={(event: MouseEvent<HTMLButtonElement>): void => {
        onComment(event.currentTarget);
      }}
    >
      <ReportIcon name="msg" />
      {label}
    </button>
  );
}
