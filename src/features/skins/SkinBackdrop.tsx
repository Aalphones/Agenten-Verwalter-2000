import type { CSSProperties, ReactElement } from 'react';
import type { SkinPack } from '@/lib/bindings/SkinPack';
import type { StyleData } from '@/lib/bindings/StyleData';
import { useSkinsStore } from '@/stores/skins';
import { skinImageUrl } from './skinImage';
import { styleOf } from './styleOf';
import './SkinBackdrop.css';

export type BackdropArea = 'sidebar' | 'content';

interface SkinBackdropProps {
  area: BackdropArea;
}

const PERCENT = 100;

function imageOf(style: StyleData, area: BackdropArea): { file: string | null; opacity: number } {
  if (area === 'sidebar') {
    return { file: style.sidebarImage, opacity: style.sidebarOpacity };
  }
  return { file: style.contentImage, opacity: style.contentOpacity };
}

/**
 * Das Hintergrundbild des aktiven Stilpakets hinter der Seitenleiste oder dem Inhalt. Der Eltern-
 * knoten muss `position: relative; isolation: isolate` haben, damit das Bild hinter dessen Inhalt
 * und doch vor dessen eigener Farbe liegt. Ohne Bild wird nichts gerendert.
 */
export function SkinBackdrop({ area }: SkinBackdropProps): ReactElement | null {
  const pack: SkinPack | null = useSkinsStore((state) => state.activeStyle);
  const style: StyleData | null = styleOf(pack);
  if (pack === null || style === null) {
    return null;
  }
  const { file, opacity }: { file: string | null; opacity: number } = imageOf(style, area);
  if (file === null) {
    return null;
  }
  const look: CSSProperties = {
    backgroundImage: `url("${skinImageUrl(pack, file)}")`,
    opacity: opacity / PERCENT,
  };
  return <div className="skin-backdrop" style={look} aria-hidden="true" />;
}
