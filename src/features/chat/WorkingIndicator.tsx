import type { ReactElement } from 'react';
import './WorkingIndicator.css';

interface WorkingIndicatorProps {
  label: string;
}

export function WorkingIndicator({ label }: WorkingIndicatorProps): ReactElement {
  return (
    <div className="working-indicator">
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
      <span className="working-indicator__label">{label}</span>
      <span className="working-indicator__hint">· Esc unterbricht</span>
    </div>
  );
}
