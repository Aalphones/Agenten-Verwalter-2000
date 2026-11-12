import type { ReactElement } from 'react';
import { CancelRequestCard } from '@/features/implementation/CancelRequestCard';
import {
  blockingStation,
  changeIdOf,
  flatStations,
  neighbors,
  type StationNeighbors,
  type StationRef,
} from '@/features/implementation/implementationOrder';
import {
  blockedText,
  BACK_TO_CURRENT_LABEL,
  BACK_TO_CURRENT_TITLE,
  stationMeta,
} from '@/features/implementation/implementationTexts';
import { PlanChangeCard } from '@/features/implementation/PlanChangeCard';
import { StationCard } from '@/features/implementation/StationCard';
import { StationDot } from '@/features/implementation/StationDot';
import type { ChangeView } from '@/lib/bindings/ChangeView';
import type { Effort } from '@/lib/bindings/Effort';
import type { ImplementationView } from '@/lib/bindings/ImplementationView';
import type { ModelId } from '@/lib/bindings/ModelId';
import type { PendingCancel } from '@/lib/bindings/PendingCancel';
import type { SessionSummary } from '@/lib/bindings/SessionSummary';
import './CardStack.css';

interface CardStackProps {
  implementation: ImplementationView;
  /** Station oder Plan-Änderung (`change:<ID>`). */
  focusedId: string;
  /** Der Fokus weicht von der Automatik ab; erst dann gibt es „Zur aktuellen“. */
  isManualFocus: boolean;
  now: number;
  changesCount: number | null;
  /** Session der Station im Fokus; `null` ohne Session. */
  session: SessionSummary | null;
  onPickPlan: (stationId: string, model: ModelId | null, effort: Effort | null) => void;
  onPickModel: (stationId: string, model: ModelId) => void;
  onPickEffort: (stationId: string, effort: Effort) => void;
  onFocus: (focusId: string) => void;
  onBackToCurrent: () => void;
  onOpenChat: (stationId: string) => void;
  onOpenSession: (sessionId: string) => void;
  onShowChanges: (stationId: string) => void;
  onStart: (stationId: string) => void;
  onCancelCountdown: (stationId: string) => void;
  onCompleteByUser: (stationId: string, result: string) => void;
  /** „Bestätigen“ (`true`) oder „Verwerfen“ der Anfrage „Umsetzung abbrechen?“. */
  onApplyCancel: (accept: boolean) => void;
}

/** Die Kartei: groß die Karte im Fokus, darüber bis zu drei vorige, darunter bis zu drei kommende. */
export function CardStack({
  implementation,
  focusedId,
  isManualFocus,
  now,
  changesCount,
  session,
  onPickPlan,
  onPickModel,
  onPickEffort,
  onFocus,
  onBackToCurrent,
  onOpenChat,
  onOpenSession,
  onShowChanges,
  onStart,
  onCancelCountdown,
  onCompleteByUser,
  onApplyCancel,
}: CardStackProps): ReactElement | null {
  const changeId: string | null = changeIdOf(focusedId);
  const focusedChange: ChangeView | undefined =
    changeId === null
      ? undefined
      : implementation.changes.find((change: ChangeView) => change.id === changeId);
  const focusedStation: StationRef | undefined = flatStations(implementation).find(
    (ref: StationRef) => ref.station.id === focusedId,
  );
  const around: StationNeighbors = neighbors(implementation, focusedId);

  function renderSmall(ref: StationRef): ReactElement {
    return (
      <button
        key={ref.station.id}
        type="button"
        className="card-stack__small"
        title="Holt diese Station nach vorn"
        onClick={(): void => {
          onFocus(ref.station.id);
        }}
      >
        <StationDot state={ref.station.state} />
        <span className="card-stack__small-title">
          {ref.phase.key} · {ref.station.stage}
        </span>
        <span className="card-stack__small-meta">{stationMeta(ref.station, now)}</span>
      </button>
    );
  }

  function renderCurrent(): ReactElement | null {
    if (focusedChange !== undefined) {
      return (
        <PlanChangeCard
          sessionNumber={focusedChange.sessionNumber}
          at={focusedChange.at}
          summary={focusedChange.summary}
          stationsBefore={focusedChange.stationsBefore}
          stationsAfter={focusedChange.stationsAfter}
          onOpenChat={(): void => {
            onOpenSession(focusedChange.sessionId);
          }}
        />
      );
    }
    if (focusedStation === undefined) {
      return null;
    }
    return (
      <StationCard
        stationRef={focusedStation}
        now={now}
        changesCount={changesCount}
        session={session}
        onPickPlan={onPickPlan}
        onPickModel={onPickModel}
        onPickEffort={onPickEffort}
        onOpenChat={onOpenChat}
        onShowChanges={onShowChanges}
        onStart={onStart}
        onCancelCountdown={onCancelCountdown}
        onCompleteByUser={onCompleteByUser}
      />
    );
  }

  const request: PendingCancel | null = implementation.pendingCancel;
  const blocking: StationRef | undefined = blockingStation(implementation);
  // Die Anfrage eines Agenten steht über der Kartei, egal welche Karte im Fokus ist.
  const requestCard: ReactElement | null =
    request === null ? null : (
      <CancelRequestCard
        request={request}
        blockedText={
          blocking === undefined ? null : blockedText(blocking.phase.key, blocking.station.stage)
        }
        onApply={onApplyCancel}
      />
    );
  const current: ReactElement | null = renderCurrent();
  if (current === null) {
    return requestCard === null ? null : <div className="card-stack">{requestCard}</div>;
  }
  return (
    <div className="card-stack" aria-live="polite">
      {requestCard}
      <div className="card-stack__bar">
        <span className="card-stack__label">Kartei</span>
        {isManualFocus && (
          <button
            type="button"
            className="card-stack__back"
            title={BACK_TO_CURRENT_TITLE}
            onClick={onBackToCurrent}
          >
            {BACK_TO_CURRENT_LABEL}
          </button>
        )}
      </div>
      <div className="card-stack__previous">{around.previous.map(renderSmall)}</div>
      <div className="card-stack__current">{current}</div>
      <div className="card-stack__next">{around.next.map(renderSmall)}</div>
      <p className="card-stack__hint">
        <kbd>↑</kbd> <kbd>↓</kbd> blättern durch die Stationen.
      </p>
    </div>
  );
}
