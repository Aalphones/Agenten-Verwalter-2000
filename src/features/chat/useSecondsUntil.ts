import { useEffect, useState } from 'react';

const TICK_MS = 250;

/** Ganze Sekunden bis `target` (ms seit der Epoche), aufgerundet, nie unter 0; `null` ohne Ziel.
 *  Die Uhr steht still, solange kein Ziel gesetzt ist — für ein neues Ziel die Komponente neu
 *  einhängen (`key`), sonst zeigt der erste Wert bis zum nächsten Takt die alte Uhrzeit. */
export function useSecondsUntil(target: number | null): number | null {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    if (target === null) {
      return;
    }
    const timer: number = window.setInterval(() => {
      setNow(Date.now());
    }, TICK_MS);
    return (): void => {
      window.clearInterval(timer);
    };
  }, [target]);

  if (target === null) {
    return null;
  }
  return Math.max(0, Math.ceil((target - now) / 1000));
}
