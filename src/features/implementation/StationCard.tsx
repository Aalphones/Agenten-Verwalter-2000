import type { ReactElement } from 'react';
import type { StationRef } from '@/features/implementation/implementationOrder';
import {
  DONE_BY_USER_LABEL,
  DONE_BY_USER_TITLE,
  OPEN_CHAT_LABEL,
  OPEN_CHAT_TITLE,
  stateText,
} from '@/features/implementation/implementationTexts';
import { stateTone } from '@/features/implementation/stationState';
import './StationCard.css';

interface StationCardProps {
  stationRef: StationRef;
  now: number;
  /** Dateien unter „Alle“ im Vorhaben; `null` ohne Changes. */
  changesCount: number | null;
  onOpenChat: (stationId: string) => void;
  onShowChanges: () => void;
}

/** Die große Karte der Station im Fokus. Fragen werden im Chat beantwortet, nicht hier. */
export function StationCard({
  stationRef,
  now,
  changesCount,
  onOpenChat,
  onShowChanges,
}: StationCardProps): ReactElement {
  const { station, phase } = stationRef;
  const number: string = station.sessionNumber === null ? '' : `#${String(station.sessionNumber)}`;

  function renderQuestion(): ReactElement | null {
    if (station.state !== 'asking' || station.question === null) {
      return null;
    }
    return <p className="station-card__question">{station.question}</p>;
  }

  function renderResult(): ReactElement | null {
    if (station.state !== 'done' || station.result === null) {
      return null;
    }
    return <p className="station-card__result">{station.result}</p>;
  }

  function renderChatButton(): ReactElement | null {
    if (station.sessionId === null) {
      return null;
    }
    return (
      <button
        type="button"
        className="station-card__button station-card__button--primary"
        title={OPEN_CHAT_TITLE}
        onClick={(): void => {
          onOpenChat(station.id);
        }}
      >
        {OPEN_CHAT_LABEL}
      </button>
    );
  }

  function renderDoneButton(): ReactElement | null {
    if (!station.byUser || station.state !== 'waitsForYou') {
      return null;
    }
    // Verdrahtet mit dem Start der Stationen; bis dahin nur sichtbar.
    return (
      <button type="button" className="station-card__button" title={DONE_BY_USER_TITLE} disabled>
        {DONE_BY_USER_LABEL}
      </button>
    );
  }

  function renderChangesButton(): ReactElement | null {
    if (changesCount === null) {
      return null;
    }
    return (
      <button
        type="button"
        className="station-card__button"
        title="Zeigt die geänderten Dateien des ganzen Vorhabens"
        onClick={onShowChanges}
      >
        Changes · {String(changesCount)} Dateien
      </button>
    );
  }

  return (
    <article
      className={`station-card station-card--${stateTone(station.state)}`}
      aria-label={`Phase ${phase.key} · ${station.stage}`}
    >
      <div className="station-card__head">
        <b className="station-card__title">
          Phase {phase.key} · {station.stage}
        </b>
        <span className="station-card__number">{number}</span>
      </div>
      <p className="station-card__phase">{phase.title}</p>
      <p className="station-card__state">{stateText(station, now)}</p>
      {renderQuestion()}
      {renderResult()}
      <div className="station-card__actions">
        {renderChatButton()}
        {renderDoneButton()}
        {renderChangesButton()}
      </div>
    </article>
  );
}
