import { useEffect } from 'react';
import type { UnlistenFn } from '@tauri-apps/api/event';
import type { VoiceModelEvent } from '@/lib/bindings/VoiceModelEvent';
import type { VoiceModelState } from '@/lib/bindings/VoiceModelState';
import { commandErrorText } from '@/lib/errors';
import { loadVoiceModelState, onVoiceModel } from '@/lib/voice';
import { useVoiceStore } from '@/stores/voice';

/** Hält den Zustand des Sprachmodells im Store: einmal laden, danach jedes `voice://model`. Gehört einmal in die
 *  App, nicht in jeden Mikrofon-Knopf. */
export function useVoiceModel(): void {
  useEffect(() => {
    const controller = new AbortController();
    let unlisten: UnlistenFn | null = null;

    // Erst abonnieren, dann laden: ein Ereignis zwischen Stand und Abo ginge sonst verloren; und ein Ereignis, das
    // schon da ist, ist neuer als der geladene Stand.
    onVoiceModel((event: VoiceModelEvent) => {
      const store = useVoiceStore.getState();
      store.setModelState(event.state);
      store.setDownloadError(event.error);
    })
      .then((stop: UnlistenFn) => {
        if (controller.signal.aborted) {
          stop();
          return;
        }
        unlisten = stop;
        return loadVoiceModelState().then((state: VoiceModelState) => {
          if (!controller.signal.aborted && useVoiceStore.getState().modelState === null) {
            useVoiceStore.getState().setModelState(state);
          }
        });
      })
      .catch((reason: unknown) => {
        console.error('Zustand des Sprachmodells nicht ladbar', commandErrorText(reason));
      });

    return (): void => {
      controller.abort();
      if (unlisten !== null) {
        unlisten();
      }
    };
  }, []);
}
