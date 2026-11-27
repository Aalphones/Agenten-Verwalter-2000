import type { ReactElement } from 'react';
import { ReviewCommentCard } from '@/features/review/ReviewCommentCard';
import { NO_COMMENTS, useReviewStore } from '@/stores/review';
import type { CollectedComment } from '@/stores/review';
import './ReviewCommentList.css';

const DEFAULT_DESTINATION = 'gehen mit der nächsten Nachricht raus';

interface ReviewCommentListProps {
  /** Schlüssel im Store: eine Session-ID oder `reportCommentKey`. */
  sessionId: string;
  /** Wohin die Kommentare gehen, hinter der Zahl in der Kopfzeile. */
  destination?: string;
}

export function ReviewCommentList({
  sessionId,
  destination = DEFAULT_DESTINATION,
}: ReviewCommentListProps): ReactElement | null {
  const collected: readonly CollectedComment[] = useReviewStore(
    (state) => state.collected[sessionId] ?? NO_COMMENTS,
  );
  const updateText = useReviewStore((state) => state.updateText);
  const remove = useReviewStore((state) => state.remove);
  const clear = useReviewStore((state) => state.clear);

  if (collected.length === 0) {
    return null;
  }

  return (
    <section className="review-list" aria-label="Review-Kommentare">
      <div className="review-list__head">
        <span className="review-list__title">Review-Kommentare</span>
        <span className="review-list__note">
          {collected.length} · {destination}
        </span>
        <button
          type="button"
          className="review-list__clear"
          onClick={(): void => {
            clear(sessionId);
          }}
        >
          Alle entfernen
        </button>
      </div>
      <div className="review-list__cards">
        {collected.map((entry: CollectedComment) => (
          <ReviewCommentCard
            key={entry.id}
            comment={entry.comment}
            onEdit={(text: string): void => {
              updateText(sessionId, entry.id, text);
            }}
            onRemove={(): void => {
              remove(sessionId, entry.id);
            }}
          />
        ))}
      </div>
    </section>
  );
}
