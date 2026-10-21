import type { ReactElement } from 'react';

interface NoticeIconProps {
  size: number;
}

/** Vier Pfeile, die sich in der Mitte treffen: der Verlauf wird zusammengezogen. */
export function CompactIcon({ size }: NoticeIconProps): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path d="M3 3l3.5 3.5M13 3 9.5 6.5M3 13l3.5-3.5M13 13 9.5 9.5" />
    </svg>
  );
}

/** Zwei gegenläufige Pfeile für den Wechsel von einem Modell zum anderen. */
export function ModelSwitchIcon({ size }: NoticeIconProps): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path d="M2.5 5.5h10l-2.5-2.5M13.5 10.5h-10l2.5 2.5" />
    </svg>
  );
}
