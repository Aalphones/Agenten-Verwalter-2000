import type { ReactElement } from 'react';
import {
  changeOrigin,
  keysText,
  OPEN_CHAT_LABEL,
  OPEN_CHAT_TITLE,
  PLAN_CHANGED_TITLE,
} from '@/features/implementation/implementationTexts';
import type { ChangeSummary } from '@/lib/bindings/ChangeSummary';
import './PlanChangeCard.css';
import './StationCard.css';

interface PlanChangeCardProps {
  sessionNumber: number;
  at: number;
  summary: ChangeSummary;
  stationsBefore: number;
  stationsAfter: number;
  onOpenChat: () => void;
}

/** Die Karte zu einer übernommenen Plan-Änderung („Plan geändert“) mit „Chat öffnen“. */
export function PlanChangeCard({
  sessionNumber,
  at,
  summary,
  stationsBefore,
  stationsAfter,
  onOpenChat,
}: PlanChangeCardProps): ReactElement {
  return (
    <article
      className="station-card plan-change-card plan-change-card--applied"
      aria-label={PLAN_CHANGED_TITLE}
    >
      <div className="station-card__head">
        <b className="station-card__title">{PLAN_CHANGED_TITLE}</b>
        <span className="station-card__number">{changeOrigin(sessionNumber, at)}</span>
      </div>
      <dl className="plan-change-card__list">
        <dt>Neu</dt>
        <dd>{keysText(summary.added)}</dd>
        <dt>Vorgezogen</dt>
        <dd>{keysText(summary.moved)}</dd>
        <dt>Entfallen</dt>
        <dd>{keysText(summary.removed)}</dd>
        <dt>Geändert</dt>
        <dd>{keysText(summary.changed)}</dd>
      </dl>
      <p className="station-card__state">
        Stationen {String(stationsBefore)} → {String(stationsAfter)}
      </p>
      <div className="station-card__actions">
        <button
          type="button"
          className="station-card__button station-card__button--primary"
          title={OPEN_CHAT_TITLE}
          onClick={onOpenChat}
        >
          {OPEN_CHAT_LABEL}
        </button>
      </div>
    </article>
  );
}
