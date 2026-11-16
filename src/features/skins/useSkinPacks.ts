import { useEffect, useEffectEvent, useState } from 'react';
import type { UnlistenFn } from '@tauri-apps/api/event';
import type { SkinPackSummary } from '@/lib/bindings/SkinPackSummary';
import { commandErrorText } from '@/lib/errors';
import { listSkins, onSkinsChanged } from '@/lib/skins';

interface SkinPacks {
  /** `null`, bis die Liste zum ersten Mal da ist. */
  packs: SkinPackSummary[] | null;
  error: string | null;
}

/** Die Paketliste, neu geladen bei jeder Änderung (`skins://changed`), auch durch den Agenten. */
export function useSkinPacks(): SkinPacks {
  const [packs, setPacks] = useState<SkinPackSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useEffectEvent((): void => {
    listSkins()
      .then((list: SkinPackSummary[]) => {
        setPacks(list);
        setError(null);
      })
      .catch((reason: unknown) => {
        console.error('Skin-Pakete nicht ladbar', reason);
        setError(commandErrorText(reason));
      });
  });

  useEffect(() => {
    reload();
    const controller = new AbortController();
    let unlisten: UnlistenFn | null = null;
    onSkinsChanged(() => {
      reload();
    })
      .then((stop: UnlistenFn) => {
        if (controller.signal.aborted) {
          stop();
          return;
        }
        unlisten = stop;
      })
      .catch((reason: unknown) => {
        console.error('Änderungen an Skins nicht abonnierbar', reason);
      });
    return (): void => {
      controller.abort();
      if (unlisten !== null) {
        unlisten();
      }
    };
  }, []);

  return { packs, error };
}
