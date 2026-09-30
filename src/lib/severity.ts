/** Ab diesem Prozentwert färbt die Oberfläche Kontext und Kontingent gelb. */
export const SEVERITY_CAUTION_PERCENT = 60;
/** Ab diesem Prozentwert färbt die Oberfläche Kontext und Kontingent rot. */
export const SEVERITY_CRITICAL_PERCENT = 80;

export type Severity = 'ok' | 'caution' | 'critical';

/** Schweregrad einer Auslastung in Prozent: unter 60 unkritisch, ab 60 gelb, ab 80 rot. */
export function severityOf(percent: number): Severity {
  if (percent >= SEVERITY_CRITICAL_PERCENT) {
    return 'critical';
  }
  if (percent >= SEVERITY_CAUTION_PERCENT) {
    return 'caution';
  }
  return 'ok';
}
