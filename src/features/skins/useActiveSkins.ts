import { useEffect, useEffectEvent } from 'react';
import type { UnlistenFn } from '@tauri-apps/api/event';
import type { SkinPack } from '@/lib/bindings/SkinPack';
import { getSkin, onSkinsChanged } from '@/lib/skins';
import { useSettingsStore } from '@/stores/settings';
import { useSkinsStore } from '@/stores/skins';

/** Paket zur ID laden; `null` ohne ID oder wenn das Paket fehlt (gelöscht, nicht mehr lesbar). */
async function loadPack(id: string | null): Promise<SkinPack | null> {
  if (id === null) {
    return null;
  }
  try {
    return await getSkin(id);
  } catch (reason: unknown) {
    console.error('Skin-Paket nicht ladbar', reason);
    return null;
  }
}

/**
 * Hält die aktiven Pakete im Store: beim Start, wenn eine Auswahl wechselt und bei jeder
 * Änderung an Paketen (`skins://changed`). Einmal in `App` aufrufen.
 */
export function useActiveSkins(): void {
  const figuresId: string | null = useSettingsStore((state) => state.settings?.skinFigures ?? null);
  const styleId: string | null = useSettingsStore((state) => state.settings?.skinStyle ?? null);

  const reload = useEffectEvent((): void => {
    Promise.all([loadPack(figuresId), loadPack(styleId)])
      .then(([figures, style]: [SkinPack | null, SkinPack | null]) => {
        useSkinsStore.getState().setActive(figures, style);
      })
      .catch((reason: unknown) => {
        console.error('Aktive Skins nicht ladbar', reason);
      });
  });

  useEffect(() => {
    reload();
  }, [figuresId, styleId]);

  useEffect(() => {
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
}
