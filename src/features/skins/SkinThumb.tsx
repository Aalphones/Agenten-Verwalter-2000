import type { ReactElement } from 'react';
import './SkinThumb.css';

interface SkinThumbProps {
  /** Adresse des Bildes; `null` = leer. */
  src: string | null;
  /** Text im leeren Feld, z. B. „leer“ oder „Text“. */
  emptyText: string;
  /** Beschreibung für den Screenreader; ohne sie ist das Bild Schmuck. */
  alt?: string;
}

/** Vorschaubild 36 × 30 mit Pixel-Skalierung; ohne Bild steht ein kurzer Text. */
export function SkinThumb({ src, emptyText, alt }: SkinThumbProps): ReactElement {
  return (
    <span className="skin-thumb">
      {src === null ? (
        <span className="skin-thumb__empty">{emptyText}</span>
      ) : (
        <img className="skin-thumb__image" src={src} alt={alt ?? ''} />
      )}
    </span>
  );
}
