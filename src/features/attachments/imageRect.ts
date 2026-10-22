export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface ImageRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Ein Bereich, dessen beide Seiten darunter liegen, gilt als Klick und nicht als aufgezogener Bereich. */
export const MIN_RECT_SIDE = 8;

function clamp(value: number, max: number): number {
  return Math.min(Math.max(value, 0), max);
}

/**
 * Rechnet zwei Punkte in Anzeigepixeln des Bilds in ein ganzzahliges Rechteck in Pixeln des Originalbilds um.
 * `scale` ist `naturalWidth / clientWidth`; das Rechteck bleibt im Bild.
 */
export function toImageRect(start: Point, end: Point, scale: number, imageSize: Size): ImageRect {
  const startX: number = clamp(Math.round(start.x * scale), imageSize.width);
  const startY: number = clamp(Math.round(start.y * scale), imageSize.height);
  const endX: number = clamp(Math.round(end.x * scale), imageSize.width);
  const endY: number = clamp(Math.round(end.y * scale), imageSize.height);
  return {
    x: Math.min(startX, endX),
    y: Math.min(startY, endY),
    width: Math.abs(endX - startX),
    height: Math.abs(endY - startY),
  };
}

export function isClickSized(rect: ImageRect): boolean {
  return rect.width < MIN_RECT_SIDE && rect.height < MIN_RECT_SIDE;
}
