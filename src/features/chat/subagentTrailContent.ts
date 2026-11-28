import type { BackgroundItem } from '@/lib/bindings/BackgroundItem';
import type { SubagentStep } from '@/lib/bindings/SubagentStep';

const CLIP_MARK = '…';

export function showsResult(item: BackgroundItem): boolean {
  return item.state !== 'running' && item.result !== null;
}

/** Die anzuzeigenden Schritte. Der Kern führt den letzten Text zugleich als `result`; steht er unter „Ergebnis“,
 *  fällt sein (womöglich gekürzter) Schritt hier weg. */
export function trailSteps(item: BackgroundItem): readonly SubagentStep[] {
  const lastText: string | null = item.steps[item.steps.length - 1]?.text ?? null;
  if (!showsResult(item) || lastText === null || item.result === null) {
    return item.steps;
  }
  const isClippedResult: boolean =
    lastText.endsWith(CLIP_MARK) && item.result.startsWith(lastText.slice(0, -CLIP_MARK.length));
  return lastText === item.result || isClippedResult ? item.steps.slice(0, -1) : item.steps;
}

/** Der Verlauf als Text für die Zwischenablage; leer ohne Schritte und Ergebnis. */
export function trailText(item: BackgroundItem): string {
  const lines: string[] = trailSteps(item).map(
    (step: SubagentStep) => step.text ?? `⎿ ${step.tool}  ${step.target}`,
  );
  if (showsResult(item) && item.result !== null) {
    lines.push('', 'Ergebnis', item.result);
  }
  return lines.join('\n');
}
