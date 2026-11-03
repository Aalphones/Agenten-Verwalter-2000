import { invoke } from '@tauri-apps/api/core';
import { listen, type Event, type UnlistenFn } from '@tauri-apps/api/event';
import type { ImplementationChangedEvent } from '@/lib/bindings/ImplementationChangedEvent';
import type { ImplementationView } from '@/lib/bindings/ImplementationView';

const IMPLEMENTATION_CHANGED_EVENT = 'implementation://changed';

/** Alle Umsetzungen nicht archivierter Vorhaben, neueste zuerst (ADR 048).
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `database` */
export function listImplementations(): Promise<ImplementationView[]> {
  return invoke<ImplementationView[]>('implementation_list');
}

/** Der Lagebericht als Text, wie der Agent ihn über `implementation_get` bekommt.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `implementation` (unbekannte Umsetzung), `database` */
export function loadImplementationReport(id: string): Promise<string> {
  return invoke<string>('implementation_report', { id });
}

export function onImplementationChanged(
  callback: (implementation: ImplementationView) => void,
): Promise<UnlistenFn> {
  return listen<ImplementationChangedEvent>(
    IMPLEMENTATION_CHANGED_EVENT,
    (event: Event<ImplementationChangedEvent>) => {
      callback(event.payload.implementation);
    },
  );
}

/** Schaltet „Automatisch weiter“; an: Stationen, die starten dürfen, bekommen einen Countdown.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `implementation`, `database` */
export async function setImplementationAutoStart(id: string, enabled: boolean): Promise<void> {
  await invoke('implementation_set_auto_start', { id, enabled });
}

/** „Anhalten nach dieser Session“: die nächste Fertigmeldung startet nichts mehr.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `implementation`, `database` */
export async function setImplementationStopAfterCurrent(
  id: string,
  enabled: boolean,
): Promise<void> {
  await invoke('implementation_set_stop_after_current', { id, enabled });
}

/** Startet die Station sofort, auch mit laufendem Countdown.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `implementation` (Station darf nicht starten), `sessionNotFound`, `database` */
export async function startStation(id: string, stationId: string): Promise<void> {
  await invoke('implementation_start_station', { id, stationId });
}

/** Beendet den Countdown; die Station bleibt bereit.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `implementation` */
export async function cancelStationCountdown(id: string, stationId: string): Promise<void> {
  await invoke('implementation_cancel_countdown', { id, stationId });
}

/** „Erledigt“ für eine Station des Benutzers.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `implementation` (keine Station des Benutzers), `database` */
export async function completeStationByUser(
  id: string,
  stationId: string,
  result: string,
): Promise<void> {
  await invoke('implementation_complete_station', { id, stationId, result });
}
