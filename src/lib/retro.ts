import { invoke } from '@tauri-apps/api/core';
import { listen, type Event, type UnlistenFn } from '@tauri-apps/api/event';
import type { RetroExport } from '@/lib/bindings/RetroExport';
import type { RetroProgress } from '@/lib/bindings/RetroProgress';

const RETRO_PROGRESS_EVENT = 'retro://progress';

/** Lässt je Session des Vorhabens eine Mini-Retro erstellen und schreibt die Befunde samt Verläufen in einen neuen
 *  Ordner des Workspace; kehrt erst nach dem letzten Lauf zurück.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `claudeNotFound`, `internal` (läuft schon eine Retro,
 *    keine Session mit Verlauf, keine Mini-Retro gelungen) */
export function runRetro(projectId: string): Promise<RetroExport> {
  return invoke<RetroExport>('retro_run', { projectId });
}

/** Meldet den Start eines Laufs (`done = 0`) und jede fertige Session. */
export function onRetroProgress(callback: (progress: RetroProgress) => void): Promise<UnlistenFn> {
  return listen<RetroProgress>(RETRO_PROGRESS_EVENT, (event: Event<RetroProgress>) => {
    callback(event.payload);
  });
}
