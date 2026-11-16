import { convertFileSrc } from '@tauri-apps/api/core';
import type { SkinPack } from '@/lib/bindings/SkinPack';

/** Höchste Höhe einer Figur in Bühnenkoordinaten (Bühne 104 × 64). */
const MAX_FIGURE_HEIGHT = 56;
/** Kleine Bilder werden so weit vergrößert, damit Pixel-Figuren lesbar bleiben. */
const FIGURE_SCALE = 1.5;

/** Höhe, mit der ein Bild der natürlichen Höhe in der Bühne steht: `min(56, Höhe × 1,5)`. */
export function fitFigureHeight(naturalHeight: number): number {
  return Math.min(MAX_FIGURE_HEIGHT, Math.round(naturalHeight * FIGURE_SCALE));
}

/** Adresse eines Bildes im Bildordner des Pakets; `changedAt` hängt dran, damit ein ersetztes Bild nicht aus dem Cache kommt. */
export function skinImageUrl(pack: SkinPack, file: string): string {
  return `${convertFileSrc(`${pack.dir}\\${file}`)}?v=${encodeURIComponent(pack.changedAt)}`;
}
