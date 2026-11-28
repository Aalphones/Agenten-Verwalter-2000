import type { ReactElement } from 'react';
import type { RowTone } from '@/features/background/backgroundLabels';
import './BackgroundRow.css';

interface BackgroundRowProps {
  icon: string;
  iconTone: RowTone;
  title: string;
  subtitle: string;
  right: string;
  rightTone: RowTone;
  /** Einzug links in Pixeln. */
  indent: number;
  isCurrent: boolean;
  onPick: () => void;
}

export function BackgroundRow({
  icon,
  iconTone,
  title,
  subtitle,
  right,
  rightTone,
  indent,
  isCurrent,
  onPick,
}: BackgroundRowProps): ReactElement {
  return (
    <button
      type="button"
      className={`background-row${isCurrent ? ' background-row--current' : ''}`}
      style={{ paddingLeft: `${String(indent)}px` }}
      aria-current={isCurrent}
      onClick={onPick}
    >
      <span className={`background-row__icon background-row__icon--${iconTone}`} aria-hidden="true">
        {icon}
      </span>
      <span className="background-row__text">
        <span className="background-row__title">{title}</span>
        <span className="background-row__subtitle">{subtitle}</span>
      </span>
      <span className={`background-row__right background-row__right--${rightTone}`}>{right}</span>
    </button>
  );
}
