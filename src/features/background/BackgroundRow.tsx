import type { ReactElement } from 'react';
import type { RowTone } from '@/features/background/backgroundLabels';
import './BackgroundRow.css';

interface BackgroundRowProps {
  icon: string;
  iconTone: RowTone;
  title: string;
  /** Überschrift in Festbreitenschrift (Befehle, Dateinamen). */
  isMono: boolean;
  subtitle: string | null;
  right: string;
  rightTone: RowTone;
  /** Einzug links in Pixeln; Ordner im Scratchpad-Baum rücken ein. */
  indent: number;
  isCurrent: boolean;
  /** `null`: Zeile ist nicht wählbar (Ordner). */
  onPick: (() => void) | null;
}

export function BackgroundRow({
  icon,
  iconTone,
  title,
  isMono,
  subtitle,
  right,
  rightTone,
  indent,
  isCurrent,
  onPick,
}: BackgroundRowProps): ReactElement {
  const content: ReactElement = (
    <>
      <span className={`background-row__icon background-row__icon--${iconTone}`} aria-hidden="true">
        {icon}
      </span>
      <span className="background-row__text">
        <span className={`background-row__title${isMono ? ' background-row__title--mono' : ''}`}>
          {title}
        </span>
        {subtitle !== null && <span className="background-row__subtitle">{subtitle}</span>}
      </span>
      <span className={`background-row__right background-row__right--${rightTone}`}>{right}</span>
    </>
  );
  const style = { paddingLeft: `${String(indent)}px` };

  if (onPick === null) {
    return (
      <div className="background-row" style={style}>
        {content}
      </div>
    );
  }
  return (
    <button
      type="button"
      className={`background-row background-row--pickable${isCurrent ? ' background-row--current' : ''}`}
      style={style}
      aria-current={isCurrent}
      onClick={onPick}
    >
      {content}
    </button>
  );
}
