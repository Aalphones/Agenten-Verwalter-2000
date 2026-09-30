import type { ReactElement } from 'react';
import type { Severity } from '@/lib/severity';
import './SeverityIcon.css';

interface SeverityIconProps {
  severity: Severity;
  size?: number;
}

/** Häkchen, Ausrufezeichen im Dreieck oder im Kreis — in der Farbe des umgebenden `.severity--*`. */
export function SeverityIcon({ severity, size = 12 }: SeverityIconProps): ReactElement {
  return (
    <svg
      className="severity-icon"
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {renderShape(severity)}
    </svg>
  );
}

function renderShape(severity: Severity): ReactElement {
  switch (severity) {
    case 'ok':
      return (
        <>
          <circle cx="7" cy="7" r="5.5" />
          <path d="M4.6 7.2 6.3 8.9 9.5 5.3" />
        </>
      );
    case 'caution':
      return (
        <>
          <path d="M7 1.8 12.6 11.6H1.4Z" />
          <path d="M7 5.6v2.8M7 9.9v.1" />
        </>
      );
    case 'critical':
      return (
        <>
          <circle cx="7" cy="7" r="5.5" />
          <path d="M7 4.2v3.4M7 9.6v.1" />
        </>
      );
  }
}
