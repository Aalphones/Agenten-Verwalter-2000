import type { ReactElement, ReactNode } from 'react';

interface IconProps {
  size?: number | undefined;
}

function Frame({ size = 14, children }: IconProps & { children: ReactNode }): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
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

/** Symbol der Art eines Artefakts (`kind` aus dem Index). */
export function KindIcon({ kind, size }: IconProps & { kind: string }): ReactElement {
  switch (kind) {
    case 'code':
      return (
        <Frame size={size}>
          <path d="M5 4 2 7l3 3M9 4l3 3-3 3" />
        </Frame>
      );
    case 'web':
      return (
        <Frame size={size}>
          <circle cx="7" cy="7" r="5.5" />
          <path d="M1.5 7h11M7 1.5c1.8 2.2 1.8 8.8 0 11M7 1.5c-1.8 2.2-1.8 8.8 0 11" />
        </Frame>
      );
    case 'image':
      return (
        <Frame size={size}>
          <rect x="1.5" y="2.5" width="11" height="9" rx="1" />
          <path d="m1.5 9.5 3-3 3 3 2-2 3 3" />
        </Frame>
      );
    default:
      return (
        <Frame size={size}>
          <path d="M3.5 1.5h5l2.5 2.5v8.5h-7.5zM8.5 1.5V4H11M5.5 7h3M5.5 9.5h3" />
        </Frame>
      );
  }
}

export function SearchIcon({ size }: IconProps): ReactElement {
  return (
    <Frame size={size}>
      <circle cx="6" cy="6" r="4" />
      <path d="m9 9 3.5 3.5" />
    </Frame>
  );
}

export function BookIcon({ size }: IconProps): ReactElement {
  return (
    <Frame size={size}>
      <path d="M3 1.5h7.5a1 1 0 0 1 1 1V11a1 1 0 0 1-1 1H3.5A1.5 1.5 0 0 1 2 10.5v-8A1 1 0 0 1 3 1.5zM2 10.5A1.5 1.5 0 0 1 3.5 9h8" />
    </Frame>
  );
}

export function OpenIcon({ size }: IconProps): ReactElement {
  return (
    <Frame size={size}>
      <path d="M8 2h4v4M12 2 6.5 7.5M10.5 8.5v3a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3" />
    </Frame>
  );
}

export function FolderIcon({ size }: IconProps): ReactElement {
  return (
    <Frame size={size}>
      <path d="M1.5 3.5a1 1 0 0 1 1-1h3l1.5 1.5h4.5a1 1 0 0 1 1 1v5.5a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1z" />
    </Frame>
  );
}

export function InfoIcon({ size = 13 }: IconProps): ReactElement {
  return (
    <Frame size={size}>
      <circle cx="7" cy="7" r="5.5" />
      <path d="M7 6.4v3.4" />
      <circle cx="7" cy="4.3" r=".5" fill="currentColor" />
    </Frame>
  );
}
