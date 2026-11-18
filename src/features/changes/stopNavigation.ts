/** Springen von Stelle zu Stelle in einer langen Ansicht (Diff oder ganze Datei). */
export interface StopHandle {
  /** Springt zur nächsten (`1`) oder vorigen (`-1`) Stelle; am Ende geht es von vorn weiter. */
  step: (direction: 1 | -1) => void;
  /** Nummer der obersten sichtbaren Zeile der Datei; `null`, wenn die Ansicht keine kennt. */
  topLine: () => number | null;
}

/** Wo die Ansicht steht: `position` ist 0, solange noch nicht gesprungen wurde. */
export interface StopPosition {
  position: number;
  count: number;
}

/** Der Satz für den Statustext. */
export function stopStatusText(stop: StopPosition): string {
  if (stop.count === 0) {
    return 'Keine Stellen';
  }
  if (stop.position === 0) {
    return `${String(stop.count)} ${stop.count === 1 ? 'Stelle' : 'Stellen'}`;
  }
  return `Stelle ${String(stop.position)} von ${String(stop.count)}`;
}

/** Die nächste Stelle nach `current` (Index, −1 vor der ersten) in Richtung `direction`, mit Umlauf. */
export function nextStopIndex(current: number, direction: 1 | -1, count: number): number {
  if (count === 0) {
    return -1;
  }
  if (current < 0) {
    return direction === 1 ? 0 : count - 1;
  }
  return (current + direction + count) % count;
}
