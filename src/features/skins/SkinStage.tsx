import type { ReactElement } from 'react';
import { renderMotion } from '@/features/skins/motions/motionMarkup';
import type { Motion } from '@/lib/bindings/Motion';
import './SkinStage.css';

interface SkinStageProps {
  motion: Motion;
  /** Adresse des Bildes; `null` = Fach ohne Figur, dann entsteht keine Bühne. */
  image: string | null;
  /** Zweites Bild, nur für „Entwicklung“. */
  image2: string | null;
  /** `line` = Statuszeile (57 × 35), `toast` = Feier-Meldung (50 × 31). */
  size: 'line' | 'toast';
  /** Ohne Bewegung; GIFs zeigen ihr erstes Bild. */
  still: boolean;
  /** Fortschritt 0 bis 1 für „Lädt auf“ und „Wird sichtbar“; `null` ohne. */
  progress: number | null;
}

/** Die Bühne einer Figur: Bild, Bewegung und Zubehör in einem festen Rahmen. */
export function SkinStage({
  motion,
  image,
  image2,
  size,
  still,
  progress,
}: SkinStageProps): ReactElement | null {
  if (image === null) {
    return null;
  }
  return (
    <div
      className={`skin-stage skin-stage--${size}${still ? ' skin-stage--still' : ''}`}
      aria-hidden="true"
    >
      <div className="skin-stage__inner">
        {renderMotion(motion, image, image2, still, progress)}
      </div>
    </div>
  );
}
