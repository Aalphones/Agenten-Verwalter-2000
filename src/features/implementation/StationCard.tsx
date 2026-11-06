import type { ReactElement } from 'react';
import type { StationRef } from '@/features/implementation/implementationOrder';
import {
  CANCEL_COUNTDOWN_LABEL,
  CANCEL_COUNTDOWN_TITLE,
  DONE_BY_USER_LABEL,
  DONE_BY_USER_RESULT,
  DONE_BY_USER_TITLE,
  OPEN_CHAT_LABEL,
  OPEN_CHAT_TITLE,
  START_NOW_LABEL,
  plannedHint,
  START_NOW_TITLE,
  stateText,
} from '@/features/implementation/implementationTexts';
import { StationModelChip } from '@/features/implementation/StationModelChip';
import { StationQuestion } from '@/features/implementation/StationQuestion';
import { deviatesFromPlan, stateTone } from '@/features/implementation/stationState';
import type { Effort } from '@/lib/bindings/Effort';
import type { ModelId } from '@/lib/bindings/ModelId';
import type { SessionSummary } from '@/lib/bindings/SessionSummary';
import './StationCard.css';

interface StationCardProps {
  stationRef: StationRef;
  now: number;
  /** Dateien unter „Alle“ in der Session dieser Station; `null` ohne Session oder Changes. */
  changesCount: number | null;
  /** Session der Station; `null` vor dem Start. */
  session: SessionSummary | null;
  onPickPlan: (stationId: string, model: ModelId | null, effort: Effort | null) => void;
  onPickModel: (stationId: string, model: ModelId) => void;
  onPickEffort: (stationId: string, effort: Effort) => void;
  onOpenChat: (stationId: string) => void;
  onShowChanges: (stationId: string) => void;
  onStart: (stationId: string) => void;
  onCancelCountdown: (stationId: string) => void;
  onCompleteByUser: (stationId: string, result: string) => void;
}

/** Die große Karte der Station im Fokus; eine offene Rückfrage wird hier beantwortet wie im Chat (ADR 055). */
export function StationCard({
  stationRef,
  now,
  changesCount,
  session,
  onPickPlan,
  onPickModel,
  onPickEffort,
  onOpenChat,
  onShowChanges,
  onStart,
  onCancelCountdown,
  onCompleteByUser,
}: StationCardProps): ReactElement {
  const { station, phase } = stationRef;
  const number: string = station.sessionNumber === null ? '' : `#${String(station.sessionNumber)}`;

  function renderQuestion(): ReactElement | null {
    if (station.state !== 'asking' || station.openQuestion === null || station.sessionId === null) {
      return null;
    }
    // Der Schlüssel setzt Sende-Sperre und Tasten je Anfrage neu auf; Entwürfe liegen im Store und bleiben.
    return (
      <StationQuestion
        key={station.openQuestion.requestId}
        sessionId={station.sessionId}
        openQuestion={station.openQuestion}
      />
    );
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
    return (
      <button
        type="button"
        className="station-card__button station-card__button--primary"
        title={DONE_BY_USER_TITLE}
        onClick={(): void => {
          onCompleteByUser(station.id, DONE_BY_USER_RESULT);
        }}
      >
        {DONE_BY_USER_LABEL}
      </button>
    );
  }

  function renderStartButtons(): ReactElement | null {
    if (station.state !== 'ready' && station.state !== 'countdown') {
      return null;
    }
    return (
      <>
        <button
          type="button"
          className="station-card__button station-card__button--primary"
          title={START_NOW_TITLE}
          onClick={(): void => {
            onStart(station.id);
          }}
        >
          {START_NOW_LABEL}
        </button>
        {station.state === 'countdown' && (
          <button
            type="button"
            className="station-card__button"
            title={CANCEL_COUNTDOWN_TITLE}
            onClick={(): void => {
              onCancelCountdown(station.id);
            }}
          >
            {CANCEL_COUNTDOWN_LABEL}
          </button>
        )}
      </>
    );
  }

  function renderChangesButton(): ReactElement | null {
    if (changesCount === null || station.sessionId === null) {
      return null;
    }
    return (
      <button
        type="button"
        className="station-card__button"
        title="Zeigt die geänderten Dateien dieser Session"
        onClick={(): void => {
          onShowChanges(station.id);
        }}
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
        <div className="station-card__head-end">
          <StationModelChip
            key={station.id}
            station={station}
            session={session}
            onPickPlan={(model: ModelId | null, effort: Effort | null): void => {
              onPickPlan(station.id, model, effort);
            }}
            onPickModel={(model: ModelId): void => {
              onPickModel(station.id, model);
            }}
            onPickEffort={(effort: Effort): void => {
              onPickEffort(station.id, effort);
            }}
          />
          <span className="station-card__number">{number}</span>
        </div>
      </div>
      <p className="station-card__phase">{phase.title}</p>
      <div className="station-card__status">
        <p className="station-card__state">{stateText(station, now)}</p>
        {deviatesFromPlan(station, session) && (
          <p className="station-card__planned">{plannedHint(station)}</p>
        )}
      </div>
      {renderQuestion()}
      {renderResult()}
      <div className="station-card__actions">
        {renderChatButton()}
        {renderStartButtons()}
        {renderDoneButton()}
        {renderChangesButton()}
      </div>
    </article>
  );
}
