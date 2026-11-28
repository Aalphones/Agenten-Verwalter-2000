import { invoke } from '@tauri-apps/api/core';
import { listen, type Event, type UnlistenFn } from '@tauri-apps/api/event';
import type { ReportChangedEvent } from '@/lib/bindings/ReportChangedEvent';
import type { ReportView } from '@/lib/bindings/ReportView';

const REPORT_CHANGED_EVENT = 'report://changed';

/** Der Review-Bericht einer Umsetzung. Die Bild-Adressen darin gelten nur für diesen Lauf der App.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `implementation` (unbekannte Umsetzung), `database` */
export function loadReport(implementationId: string): Promise<ReportView> {
  return invoke<ReportView>('report_load', { implementationId });
}

/** Die Umsetzung, zu deren Bericht die Session als Station gehört; `null`, wenn sie keine Station ist oder der Bericht
 *  weder einen Eintrag noch eine fertige Phase hat.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `implementation`, `database` */
export function reportOfSession(sessionId: string): Promise<string | null> {
  return invoke<string | null>('report_of_session', { sessionId });
}

/** Ordnet die Phase des Review-Berichts neu; kehrt sofort zurück, das Ergebnis meldet `report://changed`. Läuft die
 *  Ordnung der Phase schon, passiert nichts.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `implementation` (Phase unbekannt), `database`, `io` */
export function retidyReport(phaseId: string): Promise<void> {
  return invoke('report_retidy', { phaseId });
}

/** Bricht die laufende Ordnung der Phase ab; ohne eine passiert nichts. */
export function cancelTidy(phaseId: string): Promise<void> {
  return invoke('report_cancel_tidy', { phaseId });
}

/** Die Phasen der Umsetzung, die Haiku gerade ordnet. */
export function tidyingPhases(implementationId: string): Promise<string[]> {
  return invoke<string[]>('report_tidying', { implementationId });
}

export function onReportChanged(
  callback: (implementationId: string, tidyingPhaseIds: string[]) => void,
): Promise<UnlistenFn> {
  return listen<ReportChangedEvent>(REPORT_CHANGED_EVENT, (event: Event<ReportChangedEvent>) => {
    callback(event.payload.implementationId, event.payload.tidyingPhaseIds);
  });
}
