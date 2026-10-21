import { formatThousands } from '@/features/context/formatTokens';
import type { ModelId } from '@/lib/bindings/ModelId';
import { modelName } from '@/lib/labels';

const TRIGGER_MANUAL = 'manual';
const TRIGGER_AUTO = 'auto';

export const COMPACT_LEAD = 'Verlauf zusammengefasst';
export const COMPACT_CACHE_REBUILD = 'Cache wird neu aufgebaut';
export const SUMMARY_SHOW = 'Zusammenfassung ansehen';
export const SUMMARY_HIDE = 'Zusammenfassung ausblenden';
export const MODEL_SWITCH_LEAD = 'Modell gewechselt:';

/** „von Hand“ bzw. „automatisch“; ein unbekannter oder fehlender Auslöser wird weggelassen. */
export function compactTriggerText(trigger: string | null): string | null {
  if (trigger === TRIGGER_MANUAL) {
    return 'von Hand';
  }
  if (trigger === TRIGGER_AUTO) {
    return 'automatisch';
  }
  return null;
}

/** „vorher 64k Token, jetzt 4k“; ohne die Angaben (Agent „Autark“) `null`. */
export function compactTokensText(
  preTokens: number | null,
  postTokens: number | null,
): string | null {
  if (preTokens === null) {
    return null;
  }
  if (postTokens === null) {
    return `vorher ${formatThousands(preTokens)} Token`;
  }
  return `vorher ${formatThousands(preTokens)} Token, jetzt ${formatThousands(postTokens)}`;
}

export function modelSwitchedText(from: ModelId, to: ModelId, recacheTokens: number): string {
  return `${modelName(from)} → ${modelName(to)}. Die nächste Nachricht schreibt den Cache neu (rund ${formatThousands(recacheTokens)} Token).`;
}
