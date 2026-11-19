import { useEffect, useMemo, useRef, useState } from 'react';
import { LONGRUN_AFTER_MS } from '@/features/runs/runTexts';
import { slotFor, type CustomSlotMatch } from '@/features/skins/matchSlot';
import { LONGRUN_SLOT } from '@/features/skins/slotCatalog';
import { useSecondTick } from '@/features/skins/useSecondTick';
import type { ChatEntry } from '@/lib/bindings/ChatEntry';

/** So lange bleibt ein Text mindestens stehen, bevor der nächste kommt. */
export const MIN_STAND_MS = 4000;
/** So lange nach Beginn der Arbeit steht noch der neutrale Text. */
export const FIRST_AFTER_MS = 1000;
/** Beim Denken wechselt der Text alle so viele Sekunden. */
export const THINK_TEXT_STEP_S = 10;

const SECOND_MS = 1000;
const THINK_SLOT = 'think';
const SHELL_SLOT = 'shell';

export interface StatusFigureInput {
  entries: readonly ChatEntry[];
  isWorking: boolean;
  /** Seit wann der Agent denkt (ms seit Epoche); `null` ohne Denken. */
  thinkingSince: number | null;
  /** Eigene Fächer des aktiven Figurenpakets; leer ohne Paket. Die Liste muss stabil sein (`useMemo`). */
  custom: readonly CustomSlotMatch[];
  /** Start des laufenden Befehls (ms seit Epoche); `null` ohne laufenden Befehl. */
  runSince: number | null;
  /** Ob das aktive Paket das Fach „Langer Lauf“ belegt hat. */
  hasLongrun: boolean;
}

export interface StatusFigure {
  /** Das gezeigte Fach; `null`, solange noch keines feststeht. */
  slot: string | null;
  /** Ziel des Werkzeugs für das Fach-Muster `input` (`slotFor`); bei Befehlen der Befehl, beim Denken leer. */
  target: string;
  /** Was für `{ziel}` steht: bei Befehlen die Beschreibung, sonst `target`, ohne Ziel der Werkzeugname. */
  label: string;
  /** Der Befehl für `{befehl}`; bei anderen Werkzeugen und beim Denken leer. */
  command: string;
  /** Welcher Text des Fachs steht; nur beim Denken gesetzt (`floor(Sekunden / 10)`). */
  textIndex: number | null;
  /** Werkzeug-Aufrufe seit der letzten Nachricht des Users. */
  calls: number;
  /** Sekunden des Denkens, nur solange das Fach „Denken“ steht. */
  thinkingSeconds: number | null;
  /** Zufallswert (0 bis 1), gezogen beim Wechsel; wählt den Text, solange kein Index gilt. */
  roll: number;
}

interface Wanted {
  slot: string;
  target: string;
  label: string;
  command: string;
}

const SHELL_TOOLS: ReadonlySet<string> = new Set<string>(['Bash', 'PowerShell']);

interface Shown extends Wanted {
  roll: number;
}

interface ToolActivity {
  running: Wanted | null;
  calls: number;
}

/** Läuft ein Werkzeug (der jüngste laufende Aufruf) und wie viele gab es seit der letzten Nachricht des Users. */
function readToolActivity(
  entries: readonly ChatEntry[],
  custom: readonly CustomSlotMatch[],
): ToolActivity {
  let running: Wanted | null = null;
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
      running = {
        slot: slotFor(entry.tool, entry.target, custom),
        target: entry.target || entry.tool,
        label: entry.description ?? (entry.target || entry.tool),
        command: SHELL_TOOLS.has(entry.tool) ? entry.target : '',
      };
    }
  }
  return { running, calls };
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
  custom,
  runSince,
  hasLongrun,
}: StatusFigureInput): StatusFigure {
  const [shown, setShown] = useState<Shown | null>(null);
  const clockRef = useRef<{ workStart: number | null; lastChange: number | null }>({
    workStart: null,
    lastChange: null,
  });
  const { running, calls } = useMemo(() => readToolActivity(entries, custom), [entries, custom]);

  const [longrunSince, setLongrunSince] = useState<number | null>(null);
  useEffect(() => {
    if (runSince === null || !hasLongrun) {
      return;
    }
    const timer: number = window.setTimeout(
      (): void => {
        setLongrunSince(runSince);
      },
      Math.max(0, runSince + LONGRUN_AFTER_MS - Date.now()),
    );
    return (): void => {
      window.clearTimeout(timer);
    };
  }, [runSince, hasLongrun]);
  const isLongrun: boolean = runSince !== null && hasLongrun && longrunSince === runSince;

  const wanted: Wanted | null = useMemo(() => {
    if (running !== null) {
      // Ein passendes eigenes Fach gewinnt; nur das Fach „Befehl“ wird nach 5 s zum langen Lauf.
      return isLongrun && running.slot === SHELL_SLOT
        ? { ...running, slot: LONGRUN_SLOT }
        : running;
    }
    return thinkingSince === null ? null : { slot: THINK_SLOT, target: '', label: '', command: '' };
  }, [running, thinkingSince, isLongrun]);
  const wantedSlot: string | null = wanted?.slot ?? null;
  const wantedTarget: string = wanted?.target ?? '';
  const wantedLabel: string = wanted?.label ?? '';
  const wantedCommand: string = wanted?.command ?? '';

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
    if (
      shown?.slot === wantedSlot &&
      shown.target === wantedTarget &&
      shown.label === wantedLabel
    ) {
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
        setShown({
          slot: wantedSlot,
          target: wantedTarget,
          label: wantedLabel,
          command: wantedCommand,
          roll: Math.random(),
        });
      },
      Math.max(0, earliest - Date.now()),
    );
    return (): void => {
      window.clearTimeout(timer);
    };
  }, [isWorking, wantedSlot, wantedTarget, wantedLabel, wantedCommand, shown]);

  const isThinkingShown: boolean =
    isWorking && shown?.slot === THINK_SLOT && thinkingSince !== null;
  const now: number = useSecondTick(isThinkingShown);
  const thinkingSeconds: number | null =
    isThinkingShown && thinkingSince !== null
      ? Math.max(0, Math.floor((now - thinkingSince) / SECOND_MS))
      : null;

  if (!isWorking || shown === null) {
    return {
      slot: null,
      target: '',
      label: '',
      command: '',
      textIndex: null,
      calls,
      thinkingSeconds: null,
      roll: 0,
    };
  }
  return {
    slot: shown.slot,
    target: shown.target,
    label: shown.label,
    command: shown.command,
    textIndex: thinkingSeconds === null ? null : Math.floor(thinkingSeconds / THINK_TEXT_STEP_S),
    calls,
    thinkingSeconds,
    roll: shown.roll,
  };
}
