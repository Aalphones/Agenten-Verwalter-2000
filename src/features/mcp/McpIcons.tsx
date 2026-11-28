import type { ReactElement, ReactNode } from 'react';
import type { McpGroupKind } from '@/features/mcp/mcpTexts';

interface IconProps {
  size: number;
  children: ReactNode;
  className?: string;
}

function Icon({ size, children, className }: IconProps): ReactElement {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function ChevronIcon(): ReactElement {
  return (
    <Icon size={14}>
      <path d="M6 4l4 4-4 4" />
    </Icon>
  );
}

export function CloseIcon(): ReactElement {
  return (
    <Icon size={16}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </Icon>
  );
}

export function SearchIcon(): ReactElement {
  return (
    <Icon size={14}>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L14 14" />
    </Icon>
  );
}

export function PlusIcon(): ReactElement {
  return (
    <Icon size={16}>
      <path d="M8 3v10M3 8h10" />
    </Icon>
  );
}

export function ReconnectIcon({ isSpinning }: { isSpinning: boolean }): ReactElement {
  return (
    <Icon size={16} {...(isSpinning ? { className: 'mcp-server__spinning' } : {})}>
      <path d="M13 8a5 5 0 1 1-1.5-3.6" />
      <path d="M13 2.5V5h-2.5" />
    </Icon>
  );
}

export function EditIcon(): ReactElement {
  return (
    <Icon size={16}>
      <path d="M10.5 2.5l3 3L6 13H3v-3z" />
    </Icon>
  );
}

export function TrashIcon(): ReactElement {
  return (
    <Icon size={16}>
      <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" />
    </Icon>
  );
}

export function LockIcon(): ReactElement {
  return (
    <Icon size={12}>
      <rect x="3.5" y="7" width="9" height="6.5" rx="1.2" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </Icon>
  );
}

export function ClockIcon(): ReactElement {
  return (
    <Icon size={14}>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 5v3l2 1.5" />
    </Icon>
  );
}

export function GroupIcon({ kind }: { kind: McpGroupKind }): ReactElement {
  switch (kind) {
    case 'user':
      return (
        <Icon size={13}>
          <circle cx="8" cy="5.5" r="2.5" />
          <path d="M3 13.5c.8-2.4 2.7-3.5 5-3.5s4.2 1.1 5 3.5" />
        </Icon>
      );
    case 'repository':
      return (
        <Icon size={13}>
          <path d="M3.5 2.5h8.5v10H4.5a1 1 0 0 0-1 1zM3.5 13.5v-11M6 5.5h4" />
        </Icon>
      );
    case 'workspace':
      return (
        <Icon size={13}>
          <path d="M2 4a1 1 0 0 1 1-1h3.5L8 4.5h5a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z" />
        </Icon>
      );
    case 'local':
      return (
        <Icon size={13}>
          <path d="M3.5 2.5h8.5v10H4.5a1 1 0 0 0-1 1zM5.8 10.5c.4-1 1.2-1.5 2.2-1.5s1.8.5 2.2 1.5" />
          <circle cx="8" cy="6.5" r="1.6" />
        </Icon>
      );
    case 'fixed':
      return <LockIcon />;
  }
}

export function BackIcon(): ReactElement {
  return (
    <Icon size={16}>
      <path d="M10 3.5L5.5 8l4.5 4.5" />
    </Icon>
  );
}

export function CheckIcon(): ReactElement {
  return (
    <Icon size={14}>
      <path d="M3.5 8.5l3 3 6-7" />
    </Icon>
  );
}

export function WarnIcon(): ReactElement {
  return (
    <Icon size={14}>
      <path d="M8 2.5l6 11H2zM8 6.5v3M8 11.5v.01" />
    </Icon>
  );
}
