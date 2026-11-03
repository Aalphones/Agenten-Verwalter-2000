import { stateTone, urgencyRank, type StationTone } from '@/features/implementation/stationState';
import type { ImplementationView } from '@/lib/bindings/ImplementationView';
import type { PhaseView } from '@/lib/bindings/PhaseView';
import type { StationView } from '@/lib/bindings/StationView';

export interface StationRef {
  station: StationView;
  phase: PhaseView;
  /** Stelle in der flachen Folge aller Stationen. */
  index: number;
}

export interface StationNeighbors {
  /** Älteste zuerst; die letzte liegt unmittelbar vor der Station im Fokus. */
  previous: StationRef[];
  next: StationRef[];
}

/** Alle Stationen in Plan-Reihenfolge, jede mit ihrer Phase. */
export function flatStations(implementation: ImplementationView): StationRef[] {
  const refs: StationRef[] = [];
  for (const phase of implementation.phases) {
    for (const station of phase.stations) {
      refs.push({ station, phase, index: refs.length });
    }
  }
  return refs;
}

/** Die Station, die vorn liegt, solange niemand gewählt hat: die dringendste, bei Gleichstand die
 *  erste in Plan-Reihenfolge; ist alles fertig, die letzte. */
export function autoFocus(implementation: ImplementationView): string | null {
  const refs: StationRef[] = flatStations(implementation);
  let best: StationRef | undefined;
  for (const candidate of refs) {
    if (
      best === undefined ||
      urgencyRank(candidate.station.state) < urgencyRank(best.station.state)
    ) {
      best = candidate;
    }
  }
  if (best === undefined) {
    return null;
  }
  if (best.station.state === 'done') {
    return refs[refs.length - 1]?.station.id ?? null;
  }
  return best.station.id;
}

export function neighbors(
  implementation: ImplementationView,
  focusedId: string,
  count: number = 3,
): StationNeighbors {
  const refs: StationRef[] = flatStations(implementation);
  const position: number = refs.findIndex((ref: StationRef) => ref.station.id === focusedId);
  if (position < 0) {
    return { previous: [], next: [] };
  }
  return {
    previous: refs.slice(Math.max(0, position - count), position),
    next: refs.slice(position + 1, position + 1 + count),
  };
}

/** Farbe der Linie, die bei jeder Station von oben ankommt: grün bis zur letzten fertigen, dann in
 *  der Farbe der aktuellen (der ersten nicht fertigen) bis zu ihr, danach grau. */
export function lineTones(refs: readonly StationRef[]): StationTone[] {
  const currentIndex: number = refs.findIndex((ref: StationRef) => ref.station.state !== 'done');
  return refs.map((ref: StationRef, index: number): StationTone => {
    if (ref.station.state === 'done') {
      return 'done';
    }
    if (index === currentIndex) {
      const tone: StationTone = stateTone(ref.station.state);
      return tone === 'done' ? 'todo' : tone;
    }
    return 'todo';
  });
}
