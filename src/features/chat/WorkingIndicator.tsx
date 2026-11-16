import type { ReactElement, ReactNode } from 'react';
import './WorkingIndicator.css';

interface WorkingIndicatorProps {
  /** Was gerade läuft, schon mit eingesetztem Ziel. */
  text: string;
  /** Werkzeug-Aufrufe seit der letzten Nachricht des Users. */
  calls: number;
  /** Text des aktiven Todos; `null` ohne. */
  todo: string | null;
  /** Sekunden des Denkens; `null`, wenn der Agent nicht denkt. */
  thinkingSeconds: number | null;
  /** Figur vor dem Text; ohne Skin leer. */
  figure?: ReactNode;
}

function countLabel(calls: number, thinkingSeconds: number | null): string | null {
  if (thinkingSeconds !== null) {
    return `· ${String(thinkingSeconds)} s`;
  }
  if (calls === 0) {
    return null;
  }
  return calls === 1 ? '· 1 Aufruf' : `· ${String(calls)} Aufrufe`;
}

export function WorkingIndicator({
  text,
  calls,
  todo,
  thinkingSeconds,
  figure,
}: WorkingIndicatorProps): ReactElement {
  const count: string | null = countLabel(calls, thinkingSeconds);
  return (
    <div className="working-indicator">
      {figure ?? (
        <svg
          width="13"
          height="13"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M7 1.5v11M1.5 7h11M3 3l8 8M11 3 3 11" />
        </svg>
      )}
      <span key={text} className="working-indicator__label">
        {text}
      </span>
      {count !== null && <span className="working-indicator__count">{count}</span>}
      {todo !== null && <span className="working-indicator__todo">{todo}</span>}
      <span className="working-indicator__hint">· Esc unterbricht</span>
    </div>
  );
}
