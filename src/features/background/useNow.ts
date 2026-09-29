import { useEffect, useState } from 'react';

const TICK_MS = 1000;

/** Die aktuelle Zeit, jede Sekunde neu, solange `isTicking` — für Laufzeiten laufender Einträge. */
export function useNow(isTicking: boolean): number {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    if (!isTicking) {
      return undefined;
    }
    function tick(): void {
      setNow(Date.now());
    }
    // Sofort einmal, damit `now` nach einer Pause nicht bis zum ersten Intervall veraltet ist.
    const immediate: number = window.setTimeout(tick, 0);
    const timer: number = window.setInterval(tick, TICK_MS);
    return (): void => {
      window.clearTimeout(immediate);
      window.clearInterval(timer);
    };
  }, [isTicking]);

  return now;
}
