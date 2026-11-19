import type { ReactNode } from 'react';
import type { RunView } from '@/features/runs/runTexts';
import { FigureRider } from '@/features/skins/FigureRider';
import { FigureStage, hasFigure } from '@/features/skins/FigureStage';
import type { SkinPack } from '@/lib/bindings/SkinPack';
import type { SlotLook } from '@/lib/bindings/SlotLook';

interface StatusFigureParts {
  /** Bühne vor dem Text; `null` = bewusst keine (die Figur steht auf dem Balken), `undefined` = kein Paket oder keine Figur. */
  figure: ReactNode;
  /** Figur auf dem Balken; `undefined` ohne. */
  rider: ReactNode;
}

interface StatusFigureInput {
  pack: SkinPack | null;
  look: SlotLook | null;
  run: RunView | null;
  /** Ändert sich, wenn die Bühne neu beginnen soll (Fach, Ziel, Wurf). */
  stageKey: string;
}

/**
 * Wo die Figur der Statuszeile steht: mit der Bewegung „Läuft die Strecke ab“ und einem Balken auf dem Balken,
 * sonst in der Bühne vor dem Text; die Bewegungen mit Fortschritt folgen dem Balken.
 */
export function statusFigureParts({
  pack,
  look,
  run,
  stageKey,
}: StatusFigureInput): StatusFigureParts {
  if (pack === null || !hasFigure(look)) {
    return { figure: undefined, rider: undefined };
  }
  const fraction: number | null = run?.fraction ?? null;
  if (look.motion === 'trek' && fraction !== null) {
    return {
      figure: null,
      rider: <FigureRider pack={pack} look={look} fraction={fraction} />,
    };
  }
  return {
    figure: <FigureStage key={stageKey} pack={pack} look={look} size="line" progress={fraction} />,
    rider: undefined,
  };
}
