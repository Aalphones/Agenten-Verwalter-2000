import { figuresOf, figuresSkinData } from '@/features/skins/figuresData';
import type { SkinPackActions } from '@/features/skins/useSkinPack';
import type { FiguresData } from '@/lib/bindings/FiguresData';
import type { SkinData } from '@/lib/bindings/SkinData';

/** Speichert eine Änderung an den Fächern; bei einem Stilpaket (kann hier nicht vorkommen) passiert nichts. */
export function saveFigures(
  actions: SkinPackActions,
  update: (figures: FiguresData) => FiguresData,
): Promise<string | null> {
  return actions.save((current: SkinData): SkinData => {
    const figures: FiguresData | null = figuresOf(current);
    if (figures === null) {
      return current;
    }
    const next: FiguresData = update(figures);
    return next === figures ? current : figuresSkinData(next);
  });
}
