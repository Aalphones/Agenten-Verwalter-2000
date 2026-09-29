import type { ReactElement } from 'react';
import './DetailHead.css';

export interface DetailAction {
  label: string;
  /** Erklärt, was die Aktion tut. */
  hint: string;
  isDanger: boolean;
  isDisabled: boolean;
  onClick: () => void;
}

interface DetailHeadProps {
  title: string;
  isMono: boolean;
  meta: string;
  /** Absatz mit dem Ergebnis (Subagent); `null` ohne. */
  result: string | null;
  actions: readonly DetailAction[];
  /** Fehler der letzten Aktion oder des Ladens; `null` ohne. */
  error: string | null;
}

export function DetailHead({
  title,
  isMono,
  meta,
  result,
  actions,
  error,
}: DetailHeadProps): ReactElement {
  return (
    <div className="detail-head">
      <div className={`detail-head__title${isMono ? ' detail-head__title--mono' : ''}`}>
        {title}
      </div>
      <div className="detail-head__meta">{meta}</div>
      {result !== null && <p className="detail-head__result">{result}</p>}
      <div className="detail-head__actions">
        {actions.map((action: DetailAction) => (
          <button
            key={action.label}
            type="button"
            className={`detail-head__action${action.isDanger ? ' detail-head__action--danger' : ''}`}
            title={action.hint}
            disabled={action.isDisabled}
            onClick={action.onClick}
          >
            {action.label}
          </button>
        ))}
      </div>
      {error !== null && (
        <p className="detail-head__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
