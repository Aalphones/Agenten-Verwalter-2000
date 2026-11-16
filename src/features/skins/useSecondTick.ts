import { useEffect, useState } from 'react';

const SECOND_MS = 1000;

/** Sekündlicher Takt, solange `isActive`; liefert die aktuelle Zeit in ms. */
export function useSecondTick(isActive: boolean): number {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    if (!isActive) {
      return;
    }
    const tick = (): void => {
      setNow(Date.now());
    };
    const first: number = window.setTimeout(tick, 0);
    const timer: number = window.setInterval(tick, SECOND_MS);
    return (): void => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [isActive]);
  return now;
}
