import { severityOf } from '@/lib/severity';
import type { Severity } from '@/lib/severity';

/** Schweregrad des Kontexts. Gerundet, damit „60 %“ auf dem Bildschirm auch gelb färbt und nicht erst 60,0. */
export function contextSeverity(percent: number): Severity {
  return severityOf(Math.round(percent));
}
