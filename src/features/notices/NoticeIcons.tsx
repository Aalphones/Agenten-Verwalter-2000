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

/** Ein Schild mit Ausrufezeichen: der Sicherheitsfilter hat eingegriffen. */
export function ShieldIcon({ size }: NoticeIconProps): ReactElement {
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
      <path d="M8 1.6 13.5 3.6v4.2c0 3.2-2.4 5.5-5.5 6.6-3.1-1.1-5.5-3.4-5.5-6.6V3.6z" />
      <path d="M8 5.5v3M8 10.6v.3" strokeLinecap="round" />
    </svg>
  );
}

/** Ein Kreis mit „i“: ein Hinweis, kein Eingriff. */
export function InfoIcon({ size }: NoticeIconProps): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="6.3" />
      <path d="M8 7.2v4M8 4.8v.4" strokeLinecap="round" />
    </svg>
  );
}

/** Ein Schloss für den Modus, der bestimmt, was Claude ohne Rückfrage darf. */
export function LockIcon({ size }: NoticeIconProps): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      aria-hidden="true"
    >
      <rect x="2.5" y="7" width="11" height="7" rx="1.5" />
      <path d="M5 7V5a3 3 0 0 1 6 0v2" />
    </svg>
  );
}

/** Ein durchgestrichener Kreis für einen abgelehnten Aufruf. */
export function DeniedIcon({ size }: NoticeIconProps): ReactElement {
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
      <circle cx="8" cy="8" r="6.2" />
      <path d="M3.6 12.4l8.8-8.8" />
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
