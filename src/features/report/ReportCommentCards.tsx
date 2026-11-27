import type { ReactElement } from 'react';
import { useReportCommenting } from '@/features/report/reportCommentsContext';
import { COMMENT_COLLECTED_LABEL, COMMENT_REMOVE_LABEL } from '@/features/report/reportTexts';
import type { CollectedComment } from '@/stores/review';
import './ReportCommentCards.css';

interface ReportCommentCardsProps {
  comments: readonly CollectedComment[];
}

/** Die gesammelten Kommentare an einer Stelle des Berichts: Text, „gesammelt“ und ein Knopf zum Entfernen. */
export function ReportCommentCards({ comments }: ReportCommentCardsProps): ReactElement | null {
  const { remove } = useReportCommenting();
  if (comments.length === 0) {
    return null;
  }
  return (
    <div className="report-comments">
      {comments.map((entry: CollectedComment) => (
        <div key={entry.id} className="report-comments__card">
          <span className="report-comments__text">{entry.comment.text}</span>
          <span className="report-comments__who">{COMMENT_COLLECTED_LABEL}</span>
          <button
            type="button"
            className="report-comments__remove"
            aria-label={`Kommentar entfernen: ${entry.comment.text}`}
            onClick={(): void => {
              remove(entry.id);
            }}
          >
            {COMMENT_REMOVE_LABEL}
          </button>
        </div>
      ))}
    </div>
  );
}
