import type { CustomSlotMatch } from '@/features/skins/matchSlot';
import type { BuiltinSlotLook } from '@/lib/bindings/BuiltinSlotLook';
import type { CustomSlot } from '@/lib/bindings/CustomSlot';
import type { SkinPack } from '@/lib/bindings/SkinPack';
import type { SlotLook } from '@/lib/bindings/SlotLook';

/** Die Fächer eines Figurenpakets; ein Stilpaket und „kein Paket“ haben keine. */
function figuresOf(
  pack: SkinPack | null,
): { custom: CustomSlot[]; builtin: BuiltinSlotLook[] } | null {
  if (pack?.data.kind !== 'figures') {
    return null;
  }
  return pack.data.data;
}

/** Aussehen eines Fachs: ein eigenes Fach per ID, sonst das mitgelieferte Fach; `null`, wenn das Paket es nicht belegt. */
export function lookFor(pack: SkinPack | null, slot: string): SlotLook | null {
  const figures = figuresOf(pack);
  if (figures === null) {
    return null;
  }
  const custom: CustomSlot | undefined = figures.custom.find(
    (candidate: CustomSlot) => candidate.id === slot,
  );
  if (custom !== undefined) {
    return custom.look;
  }
  const builtin: BuiltinSlotLook | undefined = figures.builtin.find(
    (candidate: BuiltinSlotLook) => candidate.slot === slot,
  );
  return builtin?.look ?? null;
}

/** Die eigenen Fächer in der Reihenfolge des Pakets; `slotFor` prüft sie vor den mitgelieferten. */
export function customMatchers(pack: SkinPack | null): CustomSlotMatch[] {
  const figures = figuresOf(pack);
  if (figures === null) {
    return [];
  }
  return figures.custom.map((slot: CustomSlot) => ({
    id: slot.id,
    tools: slot.tools,
    input: slot.input,
  }));
}
