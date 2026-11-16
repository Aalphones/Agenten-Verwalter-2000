import type { SkinPack } from '@/lib/bindings/SkinPack';
import type { StyleData } from '@/lib/bindings/StyleData';

/** Die Stildaten eines Pakets; `null` ohne Paket oder bei einem Figurenpaket. */
export function styleOf(pack: SkinPack | null): StyleData | null {
  if (pack === null || pack.data.kind !== 'style') {
    return null;
  }
  return pack.data.data;
}
