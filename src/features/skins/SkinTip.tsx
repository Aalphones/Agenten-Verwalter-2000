import { useState } from 'react';
import type { ReactElement } from 'react';
import { FigureStage, hasFigure } from '@/features/skins/FigureStage';
import { lookFor } from '@/features/skins/figureLook';
import { figureName, MAY_FOURTH_LINE, pickTip } from '@/features/skins/tips';
import type { SkinPack } from '@/lib/bindings/SkinPack';
import type { SlotLook } from '@/lib/bindings/SlotLook';
import { useSettingsStore } from '@/stores/settings';
import { useSkinsStore } from '@/stores/skins';
import './SkinTip.css';

/** Die Figur der Zeile: das Fach „Denken“, sonst „Sonstiges“; `null`, wenn keins ein Bild trägt. */
function tipLook(pack: SkinPack): SlotLook | null {
  const think: SlotLook | null = lookFor(pack, 'think');
  if (hasFigure(think)) {
    return think;
  }
  const other: SlotLook | null = lookFor(pack, 'other');
  return hasFigure(other) ? other : null;
}

function tipLine(tip: string, pack: SkinPack, look: SlotLook | null): string {
  if (tip === MAY_FOURTH_LINE) {
    return tip;
  }
  return look === null ? `Tipp: ${tip}` : `${figureName(pack.name)} weiß: ${tip}`;
}

/**
 * Eine Zeile mit Tipp am Ende der Einstiegsansicht einer neuen Session. Nur mit aktivem
 * Figurenpaket; am 4. Mai (mit „Easter Eggs“) steht der Gruß statt eines Tipps.
 */
export function SkinTip(): ReactElement | null {
  const pack: SkinPack | null = useSkinsStore((state) => state.activeFigures);
  const isEasterEggs: boolean = useSettingsStore(
    (state) => state.settings?.skinEasterEggs ?? false,
  );
  // Der Tipp wird einmal je Anzeige gewürfelt und bleibt stehen, solange die Ansicht offen ist.
  const [roll] = useState<number>(() => Math.random());
  const [today] = useState<Date>(() => new Date());
  if (pack === null) {
    return null;
  }
  const look: SlotLook | null = tipLook(pack);
  return (
    <div className="skin-tip">
      {look !== null && <FigureStage pack={pack} look={look} size="toast" />}
      <p className="skin-tip__text">{tipLine(pickTip(today, isEasterEggs, roll), pack, look)}</p>
    </div>
  );
}
