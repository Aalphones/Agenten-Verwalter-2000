import type { ReactElement } from 'react';
import { useSessionErrorsStore } from '@/stores/sessionErrors';
import './SessionActionError.css';

interface SessionActionErrorProps {
  sessionId: string;
}

export function SessionActionError({ sessionId }: SessionActionErrorProps): ReactElement | null {
  const message: string | undefined = useSessionErrorsStore((state) => state.errors[sessionId]);
  const clear = useSessionErrorsStore((state) => state.clear);

  if (message === undefined) {
    return null;
  }
  return (
    <div className="session-action-error" role="alert">
      <span className="session-action-error__text">{message}</span>
      <button
        type="button"
        className="session-action-error__close"
        aria-label="Meldung schließen"
        onClick={(): void => {
          clear(sessionId);
        }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path
            d="M2 2l6 6M8 2l-6 6"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}
