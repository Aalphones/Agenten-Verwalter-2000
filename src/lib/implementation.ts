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
