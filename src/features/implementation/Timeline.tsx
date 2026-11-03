import { Fragment, type ReactElement } from 'react';
import {
  flatStations,
  lineTones,
  type StationRef,
} from '@/features/implementation/implementationOrder';
import {
  NO_PHASES,
  phaseMeta,
  stationMeta,
  TIMELINE_LABEL,
} from '@/features/implementation/implementationTexts';
import { StationDot } from '@/features/implementation/StationDot';
import type { StationTone } from '@/features/implementation/stationState';
import type { ImplementationView } from '@/lib/bindings/ImplementationView';
import type { PhaseView } from '@/lib/bindings/PhaseView';
import './Timeline.css';

interface TimelineProps {
  implementation: ImplementationView;
  focusedId: string | null;
  now: number;
  onFocus: (stationId: string) => void;
  onOpenChat: (stationId: string) => void;
}

interface LineSegments {
  /** Farbe der Linie oberhalb des Punkts; `null` ganz oben. */
  above: StationTone | null;
  /** Farbe der Linie unterhalb des Punkts; `null` ganz unten. */
  below: StationTone | null;
}

/** „Review #7“; solange die Station keine Session hat, nur die Stufe. */
function stationLabel(ref: StationRef): string {
  const number: number | null = ref.station.sessionNumber;
  return number === null ? ref.station.stage : `${ref.station.stage} #${String(number)}`;
}

/** Die Zeitleiste: je Phase eine Überschrift, darunter je Station eine Zeile, durch eine Linie verbunden.
 *  Eine Phase mit nur einer Station (mechanisch) zeigt diese Station an der Überschrift. */
export function Timeline({
  implementation,
  focusedId,
  now,
  onFocus,
  onOpenChat,
}: TimelineProps): ReactElement {
  const refs: StationRef[] = flatStations(implementation);
  const tones: StationTone[] = lineTones(refs);

  function segmentsAt(index: number): LineSegments {
    return {
      above: index === 0 ? null : (tones[index] ?? null),
      below: tones[index + 1] ?? null,
    };
  }

  function renderLines(segments: LineSegments): ReactElement {
    return (
      <>
        {segments.above !== null && (
          <span
            className={`timeline__line timeline__line--above timeline__line--${segments.above}`}
          />
        )}
        {segments.below !== null && (
          <span
            className={`timeline__line timeline__line--below timeline__line--${segments.below}`}
          />
        )}
      </>
    );
  }

  function renderStation(ref: StationRef, label: string, meta: string): ReactElement {
    const isFocused: boolean = ref.station.id === focusedId;
    return (
      <div key={ref.station.id} role="listitem" className="timeline__row">
        {renderLines(segmentsAt(ref.index))}
        <button
          type="button"
          className={`timeline__station${isFocused ? ' timeline__station--focused' : ''}`}
          aria-current={isFocused ? 'true' : undefined}
          title="Zeigt diese Station vorn in der Kartei; Doppelklick öffnet den Chat"
          onClick={(): void => {
            onFocus(ref.station.id);
          }}
          onDoubleClick={(): void => {
            onOpenChat(ref.station.id);
          }}
        >
          <StationDot state={ref.station.state} />
          <span className="timeline__label">{label}</span>
          <span className={`timeline__meta timeline__meta--${ref.station.state}`}>{meta}</span>
        </button>
      </div>
    );
  }

  function renderPhase(phase: PhaseView): ReactElement {
    const phaseRefs: StationRef[] = refs.filter((ref: StationRef) => ref.phase.id === phase.id);
    const [only] = phaseRefs;
    if (only !== undefined && phaseRefs.length === 1) {
      return renderStation(only, `${phase.key} ${phase.title}`, stationMeta(only.station, now));
    }
    const firstIndex: number = phaseRefs[0]?.index ?? 0;
    const headingTone: StationTone | null = firstIndex === 0 ? null : (tones[firstIndex] ?? null);
    return (
      <Fragment key={phase.id}>
        <div role="listitem" className="timeline__row timeline__phase">
          {headingTone !== null && (
            <span
              className={`timeline__line timeline__line--full timeline__line--${headingTone}`}
            />
          )}
          <span className="timeline__phase-title">
            <span className="timeline__phase-key">{phase.key}</span>
            <b>{phase.title}</b>
          </span>
          <span className="timeline__meta">{phaseMeta(phase)}</span>
        </div>
        {phaseRefs.map((ref: StationRef) =>
          renderStation(ref, stationLabel(ref), stationMeta(ref.station, now)),
        )}
      </Fragment>
    );
  }

  if (implementation.phases.length === 0) {
    return <p className="timeline__empty">{NO_PHASES}</p>;
  }
  return (
    <div className="timeline" role="list" aria-label={TIMELINE_LABEL}>
      {implementation.phases.map(renderPhase)}
    </div>
  );
}
