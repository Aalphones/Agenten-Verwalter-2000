import { invoke } from '@tauri-apps/api/core';
import type { ArchivePage } from '@/lib/bindings/ArchivePage';
import type { ProjectRestored } from '@/lib/bindings/ProjectRestored';

/** Archivierte Vorhaben, jüngst archivierte zuerst — höchstens 20 je Aufruf. Ohne Suchbegriff (leer oder nur
 *  Leerzeichen) alle, ohne Ausschnitte; mit Begriff nur Treffer in Vorhaben-Name und Chat-Text, Groß/Klein egal.
 *  `offset` ist die Anzahl der Vorhaben, die dieselbe Suche schon geliefert hat.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `internal`, `io` */
export function searchArchive(query: string, offset: number): Promise<ArchivePage> {
  return invoke<ArchivePage>('archive_search', { query, offset });
}

/** Holt ein archiviertes Vorhaben mit allen Sessions zurück in die Seitenleiste; der Agent startet erst mit der
 *  nächsten Nachricht. Der Core sendet dazu kein Ereignis — die Rückgabe muss selbst in die Listen.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `internal` (unbekanntes oder nicht archiviertes
 *    Vorhaben), `io`, `git` */
export function restoreProject(projectId: string): Promise<ProjectRestored> {
  return invoke<ProjectRestored>('project_restore', { projectId });
}
