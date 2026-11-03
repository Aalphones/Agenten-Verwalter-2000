import type { ReactElement } from 'react';
import {
  flatStations,
  neighbors,
  type StationNeighbors,
  type StationRef,
} from '@/features/implementation/implementationOrder';
import {
  BACK_TO_CURRENT_LABEL,
  BACK_TO_CURRENT_TITLE,
  stationMeta,
} from '@/features/implementation/implementationTexts';
import { StationCard } from '@/features/implementation/StationCard';
import { StationDot } from '@/features/implementation/StationDot';
import type { ImplementationView } from '@/lib/bindings/ImplementationView';
import './CardStack.css';

interface CardStackProps {
  implementation: ImplementationView;
  focusedId: string;
  /** Der Fokus weicht von der Automatik ab; erst dann gibt es „Zur aktuellen“. */
  isManualFocus: boolean;
  now: number;
  changesCount: number | null;
  onFocus: (stationId: string) => void;
  onBackToCurrent: () => void;
  onOpenChat: (stationId: string) => void;
  onShowChanges: () => void;
}

/** Die Kartei: groß die Station im Fokus, darüber bis zu drei vorige, darunter bis zu drei kommende. */
export function CardStack({
  implementation,
  focusedId,
  isManualFocus,
  now,
  changesCount,
  onFocus,
  onBackToCurrent,
  onOpenChat,
  onShowChanges,
}: CardStackProps): ReactElement | null {
  const focused: StationRef | undefined = flatStations(implementation).find(
    (ref: StationRef) => ref.station.id === focusedId,
  );
  if (focused === undefined) {
    return null;
  }
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

  return (
    <div className="card-stack" aria-live="polite">
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
      <div className="card-stack__current">
        <StationCard
          stationRef={focused}
          now={now}
          changesCount={changesCount}
          onOpenChat={onOpenChat}
          onShowChanges={onShowChanges}
        />
      </div>
      <div className="card-stack__next">{around.next.map(renderSmall)}</div>
      <p className="card-stack__hint">
        <kbd>↑</kbd> <kbd>↓</kbd> blättern durch die Stationen.
      </p>
    </div>
  );
}
