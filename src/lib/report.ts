import { invoke } from '@tauri-apps/api/core';

/** Ordnet die Phase des Review-Berichts neu; kehrt sofort zurück, das Ergebnis meldet `report://changed`. Läuft die
 *  Ordnung der Phase schon, passiert nichts.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `implementation` (Phase unbekannt), `database`, `io` */
export function retidyReport(phaseId: string): Promise<void> {
  return invoke('report_retidy', { phaseId });
}
