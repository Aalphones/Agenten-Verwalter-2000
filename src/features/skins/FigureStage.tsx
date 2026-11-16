import type { ReactElement } from 'react';
import { skinImageUrl } from '@/features/skins/skinImage';
import { SkinStage } from '@/features/skins/SkinStage';
import { useSkinAnimations } from '@/features/skins/useSkinAnimations';
import type { SkinPack } from '@/lib/bindings/SkinPack';
import type { SlotLook } from '@/lib/bindings/SlotLook';

interface FigureStageProps {
  pack: SkinPack;
  look: SlotLook;
  size: 'line' | 'toast';
}

/** Ob das Fach eine Figur zeigt; ohne Bild bleibt nur der Text. */
export function hasFigure(look: SlotLook | null): look is SlotLook & { image: string } {
  return look !== null && look.image !== null;
}

/** Die Bühne eines Fachs: löst die Bilder des Pakets auf und folgt der Einstellung „Animationen“. */
export function FigureStage({ pack, look, size }: FigureStageProps): ReactElement {
  const areAnimationsOn: boolean = useSkinAnimations();
  return (
    <SkinStage
      motion={look.motion}
      image={look.image === null ? null : skinImageUrl(pack, look.image)}
      image2={look.image2 === null ? null : skinImageUrl(pack, look.image2)}
      size={size}
      still={!areAnimationsOn}
    />
  );
}
