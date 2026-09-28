import type { ReactElement } from 'react';
import './ThinkingBlock.css';

interface ThinkingBlockProps {
  text: string;
  seconds: number;
  isExpanded: boolean;
  onToggle: () => void;
}

export function ThinkingBlock({
  text,
  seconds,
  isExpanded,
  onToggle,
}: ThinkingBlockProps): ReactElement {
  return (
    <div className="thinking-block">
      <button
        type="button"
        className="thinking-block__toggle"
        aria-expanded={isExpanded}
        onClick={onToggle}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M7 1.5v11M1.5 7h11M3 3l8 8M11 3 3 11" />
        </svg>
        <span>Gedankengang · {String(seconds)} s</span>
      </button>
      {isExpanded && <p className="thinking-block__text">{text}</p>}
    </div>
  );
}
