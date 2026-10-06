import type { ReactElement } from 'react';
import type { DisplayStatus } from '@/features/sessions/sessionStatus';
import './StatusIcon.css';

interface StatusIconProps {
  status: DisplayStatus;
  size: 10 | 12 | 14;
}

export function StatusIcon({ status, size }: StatusIconProps): ReactElement {
  return (
    <svg
      className={`status-icon status-icon--${status}`}
      width={size}
      height={size}
      viewBox="0 0 12 12"
      aria-hidden="true"
    >
      {renderShape(status)}
    </svg>
  );
}

function renderShape(status: DisplayStatus): ReactElement {
  switch (status) {
    case 'handoff':
      return (
        <>
          <circle cx="6" cy="6" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <path
            d="M4 6h3.6M5.9 4.2 7.7 6 5.9 7.8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      );
    case 'starting':
    case 'running':
      return (
        <>
          <circle cx="6" cy="6" r="5.5" fill="currentColor" opacity="0.22" />
          <circle cx="6" cy="6" r="3" fill="currentColor" />
        </>
      );
    case 'waiting':
      return (
        <>
          <circle cx="6" cy="6" r="4.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="6" cy="6" r="1.6" fill="currentColor" />
        </>
      );
    case 'error':
      return (
        <>
          <path
            d="M6 1.4 11 10.4H1Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <path d="M6 4.8v2.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="6" cy="8.8" r="0.75" fill="currentColor" />
        </>
      );
    case 'paused':
      return (
        <>
          <rect x="2.8" y="2.2" width="2.2" height="7.6" rx="0.6" fill="currentColor" />
          <rect x="7" y="2.2" width="2.2" height="7.6" rx="0.6" fill="currentColor" />
        </>
      );
    case 'new':
      return (
        <circle
          cx="6"
          cy="6"
          r="4.4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeDasharray="2 1.6"
        />
      );
    case 'completed':
    case 'cancelled':
      return (
        <path
          d="M2.4 6.3 4.9 8.7 9.6 3.4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
  }
}
