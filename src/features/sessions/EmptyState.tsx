import type { ReactElement } from 'react';
import './EmptyState.css';

interface EmptyStateProps {
  onCreate: () => void;
}

export function EmptyState({ onCreate }: EmptyStateProps): ReactElement {
  return (
    <div className="empty-state">
      <div className="empty-state__body">
        <svg
          className="empty-state__icon"
          width="36"
          height="36"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.8"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="1.5" y="1.5" width="7" height="7" rx="2" />
          <rect x="5.5" y="5.5" width="7" height="7" rx="2" />
        </svg>
        <h1 className="empty-state__title">Noch kein Vorhaben</h1>
        <p className="empty-state__text">
          Ein Vorhaben ist eine Aufgabe über ein oder mehrere Repositories. Darin arbeiten
          nacheinander eine oder mehrere Sessions, jede mit frischem Kontext. Ob ein Agent direkt im
          Repository arbeitet oder einen Worktree für sein Ticket anlegt, bestimmen seine
          Anweisungen.
        </p>
        <button type="button" className="empty-state__button" onClick={onCreate}>
          Erstes Vorhaben anlegen
        </button>
      </div>
    </div>
  );
}
