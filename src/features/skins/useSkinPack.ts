import { useEffect, useEffectEvent, useRef, useState } from 'react';
import type { UnlistenFn } from '@tauri-apps/api/event';
import type { ImageSource } from '@/lib/bindings/ImageSource';
import type { ImageTarget } from '@/lib/bindings/ImageTarget';
import type { SkinData } from '@/lib/bindings/SkinData';
import type { SkinPack } from '@/lib/bindings/SkinPack';
import { commandErrorText } from '@/lib/errors';
import {
  getSkin,
  onSkinsChanged,
  removeSkinImage,
  renameSkin,
  saveSkin,
  setSkinImage,
} from '@/lib/skins';

/** Jede Änderung liefert den Fehlersatz des Kerns oder `null`, wenn sie gespeichert wurde. */
export interface SkinPackActions {
  /** Wendet `update` auf den neuesten Stand an; liefert `update` dieselbe Referenz zurück, wird nichts gespeichert. */
  save: (update: (current: SkinData) => SkinData) => Promise<string | null>;
  rename: (name: string) => Promise<string | null>;
  setImage: (target: ImageTarget, source: ImageSource) => Promise<string | null>;
  removeImage: (target: ImageTarget) => Promise<string | null>;
}

interface SkinPackState {
  /** `null`, bis das Paket da ist oder wenn es fehlt (dann steht `loadError`). */
  pack: SkinPack | null;
  loadError: string | null;
  actions: SkinPackActions;
}

/**
 * Ein Paket für den Editor: lädt es, hält es bei Änderungen von außen aktuell und führt Änderungen
 * nacheinander aus, jede auf dem Stand der vorigen.
 */
export function useSkinPack(id: string): SkinPackState {
  const [pack, setPack] = useState<SkinPack | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const packRef = useRef<SkinPack | null>(null);
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());

  function adopt(next: SkinPack): void {
    packRef.current = next;
    setPack(next);
    setLoadError(null);
  }

  const reload = useEffectEvent((): void => {
    getSkin(id)
      .then(adopt)
      .catch((reason: unknown) => {
        console.error('Skin-Paket nicht ladbar', reason);
        packRef.current = null;
        setPack(null);
        setLoadError(commandErrorText(reason));
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
  }, [id]);

  function run(operation: (current: SkinPack) => Promise<SkinPack | null>): Promise<string | null> {
    const result: Promise<string | null> = queueRef.current.then(
      async (): Promise<string | null> => {
        const current: SkinPack | null = packRef.current;
        if (current === null) {
          return 'Das Paket ist nicht geladen.';
        }
        try {
          const next: SkinPack | null = await operation(current);
          if (next !== null) {
            adopt(next);
          }
          return null;
        } catch (reason: unknown) {
          console.error('Skin-Paket nicht geändert', reason);
          return commandErrorText(reason);
        }
      },
    );
    queueRef.current = result;
    return result;
  }

  const actions: SkinPackActions = {
    save: (update: (current: SkinData) => SkinData): Promise<string | null> =>
      run(async (current: SkinPack): Promise<SkinPack | null> => {
        const data: SkinData = update(current.data);
        if (data === current.data) {
          return null;
        }
        return saveSkin(current.id, data);
      }),
    rename: (name: string): Promise<string | null> =>
      run((current: SkinPack): Promise<SkinPack> => renameSkin(current.id, name)),
    setImage: (target: ImageTarget, source: ImageSource): Promise<string | null> =>
      run((current: SkinPack): Promise<SkinPack> => setSkinImage(current.id, target, source)),
    removeImage: (target: ImageTarget): Promise<string | null> =>
      run((current: SkinPack): Promise<SkinPack> => removeSkinImage(current.id, target)),
  };

  return { pack, loadError, actions };
}
