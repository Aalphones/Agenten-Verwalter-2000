import { useState } from 'react';
import type { CSSProperties, ReactElement } from 'react';
import { FrozenImage } from '@/features/skins/FrozenImage';
import { fitFigureHeight } from '@/features/skins/skinImage';

interface StageImageProps {
  src: string;
  /** Zusätzliche Klasse für die Bewegung, z. B. `skin-a-bob`. */
  motionClass?: string;
  /** Abstand von links in Bühnenkoordinaten. */
  left: number;
  /** Abstand vom Boden in Bühnenkoordinaten. */
  bottom?: number;
  /** Eingefroren: nur das erste Bild, keine Bewegung. */
  isStill: boolean;
  /** Weitere Stilangaben, z. B. ein Zuschnitt. */
  extraStyle?: CSSProperties;
}

/** Eine Figur in der Bühne: pixelgenau, Höhe nach der natürlichen Höhe, bis zum Laden unsichtbar. */
export function StageImage({
  src,
  motionClass,
  left,
  bottom = 0,
  isStill,
  extraStyle,
}: StageImageProps): ReactElement {
  const [height, setHeight] = useState<number | null>(null);
  const className: string = `skin-stage__figure${motionClass === undefined ? '' : ` ${motionClass}`}`;
  const position: CSSProperties = {
    left: `${String(left)}px`,
    bottom: `${String(bottom)}px`,
    ...extraStyle,
  };

  if (isStill) {
    return <FrozenImage src={src} className={className} style={position} />;
  }
  return (
    <img
      className={className}
      src={src}
      alt=""
      draggable={false}
      style={{
        ...position,
        height: height === null ? undefined : `${String(height)}px`,
        opacity: height === null ? 0 : undefined,
      }}
      onLoad={(event): void => {
        setHeight(fitFigureHeight(event.currentTarget.naturalHeight));
      }}
    />
  );
}
