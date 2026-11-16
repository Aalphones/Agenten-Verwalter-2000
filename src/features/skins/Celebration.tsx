import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { FigureStage, hasFigure } from '@/features/skins/FigureStage';
import { lookFor } from '@/features/skins/figureLook';
import { celebrationText } from '@/features/skins/statusText';
import { useSkinAnimations } from '@/features/skins/useSkinAnimations';
import type { Celebration as CelebrationData } from '@/features/skins/useCelebrations';
import type { SkinPack } from '@/lib/bindings/SkinPack';
import type { SlotLook } from '@/lib/bindings/SlotLook';
import './Celebration.css';

/** So lange steht die Meldung. */
const CELEBRATION_MS = 5000;

interface CelebrationProps {
  celebration: CelebrationData;
  pack: SkinPack;
  onDismiss: () => void;
}

/** Kurze Meldung über der Eingabeleiste: Figur und Text zu „Commit“ oder „Station fertig“. Mit `key` je Feier-Moment einhängen. */
export function Celebration({ celebration, pack, onDismiss }: CelebrationProps): ReactElement {
  const look: SlotLook | null = lookFor(pack, celebration.slot);
  const areAnimationsOn: boolean = useSkinAnimations();
  const [text] = useState<string>(() =>
    celebrationText(look, celebration.slot, celebration.commit),
  );

  useEffect(() => {
    const timer: number = window.setTimeout(onDismiss, CELEBRATION_MS);
    return (): void => {
      window.clearTimeout(timer);
    };
  }, [onDismiss]);

  return (
    <div className="celebration">
      <div
        className={`celebration__box${areAnimationsOn ? ' celebration__box--animated' : ''}`}
        role="status"
      >
        {hasFigure(look) && <FigureStage pack={pack} look={look} size="toast" />}
        <span className="celebration__text">{text}</span>
      </div>
    </div>
  );
}
