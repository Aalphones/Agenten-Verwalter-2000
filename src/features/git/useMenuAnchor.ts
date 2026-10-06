import { useCallback, useState } from 'react';
import type { MouseEvent, PointerEvent } from 'react';

export interface MenuTrigger {
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onClick: (event: MouseEvent<HTMLElement>) => void;
}

export interface MenuAnchor {
  /** Der Knopf, an dem das Menü hängt; `null`, solange es zu ist. */
  anchor: HTMLElement | null;
  close: () => void;
  /** Gehört an den auslösenden Knopf. */
  trigger: MenuTrigger;
}

/** Zustand eines Menüs, das an einem Knopf hängt. Ein Klick auf den Knopf bei offenem Menü schließt es: der
 *  `pointerdown` darf das Menü dafür nicht vorher schließen (sonst öffnete der folgende Klick es gleich wieder),
 *  deshalb endet er hier. */
export function useMenuAnchor(): MenuAnchor {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const close = useCallback((): void => {
    setAnchor(null);
  }, []);

  const trigger: MenuTrigger = {
    onPointerDown: (event: PointerEvent<HTMLElement>): void => {
      // Nur bei offenem Menü: ein anderes offenes Menü soll sich über diesen Klick weiterhin schließen.
      if (anchor !== null) {
        event.stopPropagation();
      }
    },
    onClick: (event: MouseEvent<HTMLElement>): void => {
      const button: HTMLElement = event.currentTarget;
      setAnchor((current: HTMLElement | null) => (current === null ? button : null));
    },
  };

  return { anchor, close, trigger };
}
