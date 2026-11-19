import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactElement } from 'react';
import { fitFigureHeight } from '@/features/skins/skinImage';

interface FrozenImageProps {
  src: string;
  className: string;
  /** Lage in der Bühne (`left`, `bottom`); Größe setzt die Komponente selbst. */
  style: CSSProperties;
  /** Die Klasse bestimmt die Größe; die Komponente setzt nur die Deckkraft 0 bis zum Laden. */
  fixedSize?: boolean;
}

interface FigureSize {
  width: number;
  height: number;
}

/** Zeigt von einem Bild (auch GIF) nur das erste Bild: es wird einmal auf eine Zeichenfläche kopiert. */
export function FrozenImage({
  src,
  className,
  style,
  fixedSize = false,
}: FrozenImageProps): ReactElement {
  const [size, setSize] = useState<FigureSize | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const image = new Image();
    let isCancelled = false;
    image.onload = (): void => {
      const canvas: HTMLCanvasElement | null = canvasRef.current;
      if (isCancelled || canvas === null || image.naturalHeight === 0) {
        return;
      }
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      canvas.getContext('2d')?.drawImage(image, 0, 0);
      const height: number = fitFigureHeight(image.naturalHeight);
      setSize({ width: (image.naturalWidth * height) / image.naturalHeight, height });
    };
    image.onerror = (): void => {
      console.error('Bild nicht ladbar', src);
    };
    image.src = src;
    return (): void => {
      isCancelled = true;
      image.onload = null;
      image.onerror = null;
    };
  }, [src]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        ...style,
        width: fixedSize || size === null ? undefined : `${String(size.width)}px`,
        height: fixedSize || size === null ? undefined : `${String(size.height)}px`,
        opacity: size === null ? 0 : undefined,
      }}
    />
  );
}
