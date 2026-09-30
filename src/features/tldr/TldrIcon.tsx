import type { ReactElement } from 'react';

export type TldrIconName = 'listPlus' | 'refresh' | 'chevronUp' | 'chevronDown';

interface TldrIconProps {
  name: TldrIconName;
  size: number;
}

export function TldrIcon({ name, size }: TldrIconProps): ReactElement {
  return (
    <svg
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
      {renderShape(name)}
    </svg>
  );
}

function renderShape(name: TldrIconName): ReactElement {
  switch (name) {
    case 'listPlus':
      return <path d="M2 3.5h7M2 7h4M2 10.5h5M10.5 8v4M8.5 10h4" />;
    case 'refresh':
      return <path d="M11.6 7.2A4.6 4.6 0 1 1 10.2 3.7M11.6 1.8v2.5H9.1" />;
    case 'chevronUp':
      return <path d="M3.5 8.5 7 5l3.5 3.5" />;
    case 'chevronDown':
      return <path d="M3.5 5.5 7 9l3.5-3.5" />;
  }
}
