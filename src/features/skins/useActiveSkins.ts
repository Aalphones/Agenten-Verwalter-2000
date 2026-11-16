import { useEffect, useEffectEvent } from 'react';
import type { UnlistenFn } from '@tauri-apps/api/event';
import type { SettingsOverview } from '@/lib/bindings/SettingsOverview';
import type { SkinPack } from '@/lib/bindings/SkinPack';
import { loadSettings } from '@/lib/settings';
import { getSkin, onSkinsChanged } from '@/lib/skins';
import { useSettingsStore } from '@/stores/settings';
import { useSkinsStore } from '@/stores/skins';
import { applyStyle } from './applyStyle';

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
        applyStyle(style);
      })
      .catch((reason: unknown) => {
        console.error('Aktive Skins nicht ladbar', reason);
      });
  });

  // Der Agent wählt Pakete über `skin_activate` am Store vorbei; deshalb liest jede Änderung die
  // Auswahl neu. Wechselt sie, lädt der Effekt unten die Pakete; sonst lädt es dieser Aufruf.
  const refreshSelection = useEffectEvent((): void => {
    loadSettings()
      .then((loaded: SettingsOverview) => {
        useSettingsStore.getState().setSettings(loaded.settings);
        const hasSelectionChanged: boolean =
          figuresId !== loaded.settings.skinFigures || styleId !== loaded.settings.skinStyle;
        if (!hasSelectionChanged) {
          reload();
        }
      })
      .catch((reason: unknown) => {
        console.error('Einstellungen nach Skin-Änderung nicht ladbar', reason);
        reload();
      });
  });

  useEffect(() => {
    reload();
  }, [figuresId, styleId]);

  useEffect(() => {
    const controller = new AbortController();
    let unlisten: UnlistenFn | null = null;
    onSkinsChanged(() => {
      refreshSelection();
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
