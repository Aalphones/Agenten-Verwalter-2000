import type { ReactElement } from 'react';

interface IconProps {
  size?: number;
}

const DEFAULT_SIZE = 13;

function strokeProps(size: number): Record<string, string | number> {
  return {
    width: size,
    height: size,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    'aria-hidden': 'true',
  };
}

export function BranchIcon({ size = DEFAULT_SIZE }: IconProps): ReactElement {
  return (
    <svg {...strokeProps(size)} strokeWidth="1.4">
      <circle cx="4.5" cy="3.5" r="1.6" />
      <circle cx="4.5" cy="12.5" r="1.6" />
      <circle cx="11.5" cy="5" r="1.6" />
      <path d="M4.5 5.1v5.8M11.5 6.6c0 3-7 2-7 4.3" />
    </svg>
  );
}

export function ArrowDownIcon({ size = 11 }: IconProps): ReactElement {
  return (
    <svg {...strokeProps(size)} strokeWidth="1.7">
      <path d="M8 2v11M3.5 8.5 8 13l4.5-4.5" />
    </svg>
  );
}

export function ArrowUpIcon({ size = 11 }: IconProps): ReactElement {
  return (
    <svg {...strokeProps(size)} strokeWidth="1.7">
      <path d="M8 14V3M3.5 7.5 8 3l4.5 4.5" />
    </svg>
  );
}

export function FetchIcon({ size = 14 }: IconProps): ReactElement {
  return (
    <svg {...strokeProps(size)} strokeWidth="1.4">
      <path d="M4.5 11.5a3 3 0 0 1-.3-6 4 4 0 0 1 7.6.7 2.6 2.6 0 0 1-.3 5.3" />
      <path d="M8 7.5v6M6 11.5l2 2 2-2" />
    </svg>
  );
}

export function CaretIcon({ size = 10 }: IconProps): ReactElement {
  return (
    <svg {...strokeProps(size)} strokeWidth="2">
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

export function CheckIcon({ size = DEFAULT_SIZE }: IconProps): ReactElement {
  return (
    <svg {...strokeProps(size)} strokeWidth="1.8">
      <path d="M3 8.5l3 3 7-7" />
    </svg>
  );
}

export function PlusIcon({ size = DEFAULT_SIZE }: IconProps): ReactElement {
  return (
    <svg {...strokeProps(size)} strokeWidth="1.6">
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}

export function UndoIcon({ size = DEFAULT_SIZE }: IconProps): ReactElement {
  return (
    <svg {...strokeProps(size)} strokeWidth="1.5">
      <path d="M5 3.5 2.5 6 5 8.5" />
      <path d="M2.5 6h7a4 4 0 0 1 0 8H6" />
    </svg>
  );
}

export function MoreIcon({ size = 14 }: IconProps): ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <circle cx="3.5" cy="8" r="1.2" />
      <circle cx="8" cy="8" r="1.2" />
      <circle cx="12.5" cy="8" r="1.2" />
    </svg>
  );
}

export function LockIcon({ size = DEFAULT_SIZE }: IconProps): ReactElement {
  return (
    <svg {...strokeProps(size)} strokeWidth="1.4">
      <rect x="3" y="7" width="10" height="7" rx="1.5" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </svg>
  );
}

export function CloudIcon({ size = 11 }: IconProps): ReactElement {
  return (
    <svg {...strokeProps(size)} strokeWidth="1.5">
      <path d="M4.5 12.5a3 3 0 0 1-.3-6 4 4 0 0 1 7.6.7 2.6 2.6 0 0 1-.3 5.3z" />
    </svg>
  );
}
