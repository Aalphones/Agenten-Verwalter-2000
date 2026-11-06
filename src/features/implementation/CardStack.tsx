import type { ReactElement } from 'react';
import {
  changeIdOf,
  flatStations,
  neighbors,
  PENDING_FOCUS,
  type StationNeighbors,
  type StationRef,
} from '@/features/implementation/implementationOrder';
import {
  BACK_TO_CURRENT_LABEL,
  BACK_TO_CURRENT_TITLE,
  SHOW_PENDING_LABEL,
  SHOW_PENDING_TITLE,
  stationMeta,
} from '@/features/implementation/implementationTexts';
import { PlanChangeCard } from '@/features/implementation/PlanChangeCard';
import { StationCard } from '@/features/implementation/StationCard';
import { StationDot } from '@/features/implementation/StationDot';
import type { ChangeView } from '@/lib/bindings/ChangeView';
import type { Effort } from '@/lib/bindings/Effort';
import type { ImplementationView } from '@/lib/bindings/ImplementationView';
import type { ModelId } from '@/lib/bindings/ModelId';
import type { PendingChange } from '@/lib/bindings/PendingChange';
import type { PhaseInput } from '@/lib/bindings/PhaseInput';
import type { PhaseView } from '@/lib/bindings/PhaseView';
import type { SessionSummary } from '@/lib/bindings/SessionSummary';
import type { StationView } from '@/lib/bindings/StationView';
import './CardStack.css';

interface CardStackProps {
  implementation: ImplementationView;
  /** Station, übernommene Änderung (`change:<ID>`) oder der offene Vorschlag (`plan:pending`). */
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
  onApplyChange: (accept: boolean) => void;
}

function isStationBegun(station: StationView): boolean {
  return station.sessionId !== null || station.completedAt !== null;
}

function isBegun(phase: PhaseView): boolean {
  return phase.stations.some(isStationBegun);
}

/**
 * Stationen nach einer Übernahme: die begonnener Phasen plus die des Vorschlags. Von einer
 * begonnenen Phase, die der Vorschlag nennt, bleiben nur die begonnenen Stationen; ihre offenen
 * ersetzt er (ADR 059).
 */
function stationsAfterProposal(implementation: ImplementationView, pending: PendingChange): number {
  const named: Set<string> = new Set(pending.phases.map((phase: PhaseInput) => phase.key.trim()));
  const kept: number = implementation.phases
    .filter(isBegun)
    .reduce((sum: number, phase: PhaseView) => {
      if (named.has(phase.key)) {
        return sum + phase.stations.filter(isStationBegun).length;
      }
      return sum + phase.stations.length;
    }, 0);
  const proposed: number = pending.phases.reduce(
    (sum: number, phase: PhaseInput) => sum + phase.stations.length,
    0,
  );
  return kept + proposed;
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
  onApplyChange,
}: CardStackProps): ReactElement | null {
  const pending: PendingChange | null = implementation.pendingChange;
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
    if (focusedId === PENDING_FOCUS && pending !== null) {
      return (
        <PlanChangeCard
          kind="proposal"
          sessionNumber={pending.sessionNumber}
          at={pending.at}
          summary={pending.summary}
          stationsBefore={implementation.stationsTotal}
          stationsAfter={stationsAfterProposal(implementation, pending)}
          onApply={onApplyChange}
        />
      );
    }
    if (focusedChange !== undefined) {
      return (
        <PlanChangeCard
          kind="applied"
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

  const current: ReactElement | null = renderCurrent();
  if (current === null) {
    return null;
  }
  const canShowPending: boolean = pending !== null && focusedId !== PENDING_FOCUS;
  return (
    <div className="card-stack" aria-live="polite">
      <div className="card-stack__bar">
        <span className="card-stack__label">Kartei</span>
        {canShowPending && (
          <button
            type="button"
            className="card-stack__back"
            title={SHOW_PENDING_TITLE}
            onClick={(): void => {
              onFocus(PENDING_FOCUS);
            }}
          >
            {SHOW_PENDING_LABEL}
          </button>
        )}
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
