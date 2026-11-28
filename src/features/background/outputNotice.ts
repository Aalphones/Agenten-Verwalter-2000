import type { BackgroundState } from '@/lib/bindings/BackgroundState';
import type { TextPreview } from '@/lib/bindings/TextPreview';

const TRUNCATED_NOTICE = 'Gekürzt — nur das Ende wird gezeigt.';
const MISSING_NOTICE = 'Ausgabe nicht mehr verfügbar.';
const MISSING_RUNNING_NOTICE =
  'Ausgabe noch nicht verfügbar — sie liegt erst vor, wenn der Befehl endet.';

/** Hinweis über der Ausgabe eines Befehls oder Prozesses; `null` ohne. */
export function outputNotice(output: TextPreview | null, state: BackgroundState): string | null {
  if (output === null) {
    return null;
  }
  if (output.missing) {
    return state === 'running' ? MISSING_RUNNING_NOTICE : MISSING_NOTICE;
  }
  return output.truncated ? TRUNCATED_NOTICE : null;
}
