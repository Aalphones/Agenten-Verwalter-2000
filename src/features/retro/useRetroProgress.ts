import { useEffect } from 'react';
import type { UnlistenFn } from '@tauri-apps/api/event';
import type { RetroProgress } from '@/lib/bindings/RetroProgress';
import { commandErrorText } from '@/lib/errors';
import { onRetroProgress } from '@/lib/retro';
import { useRetroStore } from '@/stores/retro';

/** Trägt den Fortschritt der Retro-Läufe in den Store ein. Gehört einmal in die App, nicht in jeden Knopf — der Lauf
 *  überlebt so das Wechseln der Ansicht. */
export function useRetroProgress(): void {
  useEffect(() => {
    const controller = new AbortController();
    let unlisten: UnlistenFn | null = null;

    onRetroProgress((progress: RetroProgress) => {
      const store = useRetroStore.getState();
      // Ein Ereignis, das nach dem Ende des Laufs eintrifft, würde den Knopf sonst für immer sperren.
      if (store.running[progress.projectId] === undefined) {
        return;
      }
      store.setProgress(progress.projectId, progress.done, progress.total);
    })
      .then((stop: UnlistenFn) => {
        if (controller.signal.aborted) {
          stop();
          return;
        }
        unlisten = stop;
      })
      .catch((reason: unknown) => {
        console.error('Fortschritt der Retro nicht abonnierbar', commandErrorText(reason));
      });

    return (): void => {
      controller.abort();
      if (unlisten !== null) {
        unlisten();
      }
    };
  }, []);
}
