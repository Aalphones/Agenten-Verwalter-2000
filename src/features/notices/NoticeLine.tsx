import type { ReactElement, ReactNode } from 'react';
import './NoticeLine.css';

export type NoticeLineVariant = 'info' | 'warn' | 'model';

interface NoticeLineAction {
  label: string;
  onClick: () => void;
}

interface NoticeLineProps {
  variant: NoticeLineVariant;
  icon: ReactNode;
  /** Fetter Anfang der Zeile. */
  lead: string;
  text: string;
  action?: NoticeLineAction;
}

export function NoticeLine({ variant, icon, lead, text, action }: NoticeLineProps): ReactElement {
  return (
    <div className={`notice-line notice-line--${variant}`} role="note">
      <span className="notice-line__icon">{icon}</span>
      <p className="notice-line__text">
        <strong>{lead}</strong> {text}
      </p>
      {action !== undefined && (
        <button type="button" className="notice-line__action" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}
