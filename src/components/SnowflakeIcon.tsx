import type { ReactElement } from 'react';

interface SnowflakeIconProps {
  size: number;
}

/** Schneeflocke für „Cache kalt“; trägt die Textfarbe ihres Umfelds. */
export function SnowflakeIcon({ size }: SnowflakeIconProps): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 1.5v11M2.2 4.25l9.6 5.5M2.2 9.75l9.6-5.5" />
      <path d="M5.5 2.6 7 4l1.5-1.4M5.5 11.4 7 10l1.5 1.4" />
    </svg>
  );
}
