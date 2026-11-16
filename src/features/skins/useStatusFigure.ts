import { useEffect, useMemo, useRef, useState } from 'react';
import { slotFor } from '@/features/skins/matchSlot';
import type { ChatEntry } from '@/lib/bindings/ChatEntry';

/** So lange bleibt ein Text mindestens stehen, bevor der nächste kommt. */
export const MIN_STAND_MS = 4000;
/** So lange nach Beginn der Arbeit steht noch der neutrale Text. */
export const FIRST_AFTER_MS = 1000;
/** Beim Denken wechselt der Text alle so viele Sekunden. */
export const THINK_TEXT_STEP_S = 10;

const SECOND_MS = 1000;
const THINK_SLOT = 'think';

export interface StatusFigureInput {
  entries: readonly ChatEntry[];
  isWorking: boolean;
  /** Seit wann der Agent denkt (ms seit Epoche); `null` ohne Denken. */
  thinkingSince: number | null;
}

export interface StatusFigure {
  /** Das gezeigte Fach; `null`, solange noch keines feststeht. */
  slot: string | null;
  /** Ziel des Werkzeugs für `{ziel}`; ohne Ziel der Werkzeugname, beim Denken leer. */
  target: string;
  /** Welcher Text des Fachs steht; nur beim Denken gesetzt (`floor(Sekunden / 10)`). */
  textIndex: number | null;
  /** Werkzeug-Aufrufe seit der letzten Nachricht des Users. */
  calls: number;
  /** Sekunden des Denkens, nur solange das Fach „Denken“ steht. */
  thinkingSeconds: number | null;
}

interface Shown {
  slot: string;
  target: string;
}

interface ToolActivity {
  running: Shown | null;
  calls: number;
}

/** Läuft ein Werkzeug (der jüngste laufende Aufruf) und wie viele gab es seit der letzten Nachricht des Users. */
function readToolActivity(entries: readonly ChatEntry[]): ToolActivity {
  let running: Shown | null = null;
  let calls = 0;
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry: ChatEntry | undefined = entries[index];
    if (entry?.kind === 'user') {
      break;
    }
    if (entry?.kind !== 'tool') {
      continue;
    }
    calls += 1;
    if (running === null && entry.state === 'running') {
      running = { slot: slotFor(entry.tool, entry.target, []), target: entry.target || entry.tool };
    }
  }
  return { running, calls };
}

/** Sekündlicher Takt, solange `isActive`; liefert die aktuelle Zeit in ms. */
function useSecondTick(isActive: boolean): number {
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

/**
 * Welches Fach die Statuszeile zeigt und wann es wechselt: erst nach `FIRST_AFTER_MS` Arbeit,
 * danach höchstens alle `MIN_STAND_MS`. Auch ein neues Ziel im selben Fach kommt erst nach
 * dieser Frist, damit die Zeile ruhig bleibt.
 */
export function useStatusFigure({
  entries,
  isWorking,
  thinkingSince,
}: StatusFigureInput): StatusFigure {
  const [shown, setShown] = useState<Shown | null>(null);
  const clockRef = useRef<{ workStart: number | null; lastChange: number | null }>({
    workStart: null,
    lastChange: null,
  });
  const { running, calls } = useMemo(() => readToolActivity(entries), [entries]);

  const wanted: Shown | null = useMemo(() => {
    if (running !== null) {
      return running;
    }
    return thinkingSince === null ? null : { slot: THINK_SLOT, target: '' };
  }, [running, thinkingSince]);
  const wantedSlot: string | null = wanted?.slot ?? null;
  const wantedTarget: string = wanted?.target ?? '';

  useEffect(() => {
    if (!isWorking) {
      return;
    }
    clockRef.current = { workStart: Date.now(), lastChange: null };
    return (): void => {
      clockRef.current = { workStart: null, lastChange: null };
      setShown(null);
    };
  }, [isWorking]);

  useEffect(() => {
    const workStart: number | null = clockRef.current.workStart;
    if (!isWorking || workStart === null || wantedSlot === null) {
      return;
    }
    if (shown?.slot === wantedSlot && shown.target === wantedTarget) {
      return;
    }
    const lastChange: number | null = clockRef.current.lastChange;
    const earliest: number = Math.max(
      workStart + FIRST_AFTER_MS,
      lastChange === null ? 0 : lastChange + MIN_STAND_MS,
    );
    const timer: number = window.setTimeout(
      (): void => {
        clockRef.current.lastChange = Date.now();
        setShown({ slot: wantedSlot, target: wantedTarget });
      },
      Math.max(0, earliest - Date.now()),
    );
    return (): void => {
      window.clearTimeout(timer);
    };
  }, [isWorking, wantedSlot, wantedTarget, shown]);

  const isThinkingShown: boolean =
    isWorking && shown?.slot === THINK_SLOT && thinkingSince !== null;
  const now: number = useSecondTick(isThinkingShown);
  const thinkingSeconds: number | null =
    isThinkingShown && thinkingSince !== null
      ? Math.max(0, Math.floor((now - thinkingSince) / SECOND_MS))
      : null;

  if (!isWorking || shown === null) {
    return { slot: null, target: '', textIndex: null, calls, thinkingSeconds: null };
  }
  return {
    slot: shown.slot,
    target: shown.target,
    textIndex: thinkingSeconds === null ? null : Math.floor(thinkingSeconds / THINK_TEXT_STEP_S),
    calls,
    thinkingSeconds,
  };
}
