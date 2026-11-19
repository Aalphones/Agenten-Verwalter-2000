import type { ReactElement } from 'react';
import { FrozenImage } from '@/features/skins/FrozenImage';
import { skinImageUrl } from '@/features/skins/skinImage';
import { useSkinAnimations } from '@/features/skins/useSkinAnimations';
import type { SkinPack } from '@/lib/bindings/SkinPack';
import type { SlotLook } from '@/lib/bindings/SlotLook';
import './FigureRider.css';

const PERCENT = 100;

interface FigureRiderProps {
  pack: SkinPack;
  look: SlotLook & { image: string };
  /** Fortschritt 0 bis 1; bestimmt die Stelle auf dem Balken. */
  fraction: number;
}

/** Die Figur auf dem Balken (Bewegung „Läuft die Strecke ab“): nur das Bild, an der Stelle des Fortschritts. */
export function FigureRider({ pack, look, fraction }: FigureRiderProps): ReactElement {
  const areAnimationsOn: boolean = useSkinAnimations();
  const src: string = skinImageUrl(pack, look.image);
  const position = { left: `${String(Math.round(fraction * PERCENT))}%` };
  return (
    <span
      className={`figure-rider${areAnimationsOn ? ' figure-rider--hop' : ''}`}
      style={position}
      aria-hidden="true"
    >
      {areAnimationsOn ? (
        <img className="figure-rider__image" src={src} alt="" draggable={false} />
      ) : (
        <FrozenImage src={src} className="figure-rider__image" style={{}} />
      )}
    </span>
  );
}
