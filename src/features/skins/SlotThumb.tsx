import type { ReactElement } from 'react';
import { hasFigure } from '@/features/skins/FigureStage';
import { lookFor } from '@/features/skins/figureLook';
import { FrozenImage } from '@/features/skins/FrozenImage';
import { skinImageUrl } from '@/features/skins/skinImage';
import type { SkinPack } from '@/lib/bindings/SkinPack';
import './SlotThumb.css';

interface SlotThumbProps {
  pack: SkinPack | null;
  slot: string;
}

/** Das unbewegte Bild eines Fachs für den Verlauf; ohne Paket oder ohne Bild im Fach steht nichts. */
export function SlotThumb({ pack, slot }: SlotThumbProps): ReactElement | null {
  const look = lookFor(pack, slot);
  if (pack === null || !hasFigure(look)) {
    return null;
  }
  return (
    <FrozenImage src={skinImageUrl(pack, look.image)} className="slot-thumb" style={{}} fixedSize />
  );
}
