import { runView, RUN_VISIBLE_AFTER_MS } from '@/features/runs/runTexts';
import type { RunInput, RunView } from '@/features/runs/runTexts';
import { useSecondTick } from '@/features/skins/useSecondTick';

/** Der Stand eines Laufs im Sekundentakt; `null` ohne Lauf und solange er jünger als `RUN_VISIBLE_AFTER_MS` ist. */
export function useRunView(run: RunInput | null): RunView | null {
  const now: number = useSecondTick(run !== null);
  if (run === null || now - run.startedAt < RUN_VISIBLE_AFTER_MS) {
    return null;
  }
  return runView(run, now);
}
