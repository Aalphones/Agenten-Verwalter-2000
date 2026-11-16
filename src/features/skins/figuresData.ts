import { FITTING_MOTION } from '@/features/skins/motionCatalog';
import { BUILTIN_SLOT_IDS, PLAIN_TEXTS } from '@/features/skins/slotCatalog';
import type { BuiltinSlotId } from '@/features/skins/slotCatalog';
import type { BuiltinSlotLook } from '@/lib/bindings/BuiltinSlotLook';
import type { CustomSlot } from '@/lib/bindings/CustomSlot';
import type { FiguresData } from '@/lib/bindings/FiguresData';
import type { SkinData } from '@/lib/bindings/SkinData';
import type { SlotLook } from '@/lib/bindings/SlotLook';
import type { StyleData } from '@/lib/bindings/StyleData';

/** Muster, das ein neues eigenes Fach bekommt: der Kern lehnt ein Fach ohne Muster ab, dieses trifft kein echtes Werkzeug. */
export const NEW_SLOT_TOOLS = 'mcp__beispiel__*';
export const NEW_SLOT_NAME = 'Neues Fach';
const NEW_SLOT_TEXT = PLAIN_TEXTS.other;

export function figuresOf(data: SkinData): FiguresData | null {
  return data.kind === 'figures' ? data.data : null;
}

export function styleOf(data: SkinData): StyleData | null {
  return data.kind === 'style' ? data.data : null;
}

export function emptyLook(): SlotLook {
  return { image: null, image2: null, motion: 'none', texts: [] };
}

export function isBuiltinSlotId(slot: string): slot is BuiltinSlotId {
  return (BUILTIN_SLOT_IDS as readonly string[]).includes(slot);
}

/** Aussehen eines mitgelieferten Fachs; ein Fach, das das Paket nicht belegt, ist leer. */
export function builtinLook(figures: FiguresData, slot: BuiltinSlotId): SlotLook {
  const entry: BuiltinSlotLook | undefined = figures.builtin.find(
    (candidate: BuiltinSlotLook) => candidate.slot === slot,
  );
  return entry?.look ?? emptyLook();
}

/** Aussehen eines Fachs, mitgeliefert oder eigen; `null`, wenn es das eigene Fach nicht gibt. */
export function slotLook(figures: FiguresData, slot: string): SlotLook | null {
  if (isBuiltinSlotId(slot)) {
    return builtinLook(figures, slot);
  }
  return figures.custom.find((candidate: CustomSlot) => candidate.id === slot)?.look ?? null;
}

/** Ersetzt das Aussehen eines Fachs; mitgelieferte Fächer werden bei Bedarf angelegt. */
export function withLook(figures: FiguresData, slot: string, look: SlotLook): FiguresData {
  if (isBuiltinSlotId(slot)) {
    const exists: boolean = figures.builtin.some(
      (candidate: BuiltinSlotLook) => candidate.slot === slot,
    );
    const builtin: BuiltinSlotLook[] = exists
      ? figures.builtin.map((candidate: BuiltinSlotLook) =>
          candidate.slot === slot ? { slot, look } : candidate,
        )
      : [...figures.builtin, { slot, look }];
    return { ...figures, builtin };
  }
  return {
    ...figures,
    custom: figures.custom.map((candidate: CustomSlot) =>
      candidate.id === slot ? { ...candidate, look } : candidate,
    ),
  };
}

/** Ändert Felder eines eigenen Fachs (Name, Muster). */
export function withCustomFields(
  figures: FiguresData,
  id: string,
  fields: Partial<Pick<CustomSlot, 'name' | 'tools' | 'input'>>,
): FiguresData {
  return {
    ...figures,
    custom: figures.custom.map((candidate: CustomSlot) =>
      candidate.id === id ? { ...candidate, ...fields } : candidate,
    ),
  };
}

export function newCustomSlot(): CustomSlot {
  // `c-` plus Hex-Ziffern erfüllt die Regel des Kerns (Kleinbuchstaben, Ziffern, Bindestrich).
  return {
    id: `c-${crypto.randomUUID().slice(0, 8)}`,
    name: NEW_SLOT_NAME,
    tools: NEW_SLOT_TOOLS,
    input: null,
    look: { image: null, image2: null, motion: 'bob', texts: [NEW_SLOT_TEXT] },
  };
}

/** Neues Fach ganz oben: eigene Fächer werden von oben nach unten geprüft. */
export function withNewCustomSlot(figures: FiguresData, slot: CustomSlot): FiguresData {
  return { ...figures, custom: [slot, ...figures.custom] };
}

/** Setzt ein entferntes Fach an seine alte Stelle zurück. */
export function withRestoredCustomSlot(
  figures: FiguresData,
  slot: CustomSlot,
  index: number,
): FiguresData {
  const custom: CustomSlot[] = [...figures.custom];
  custom.splice(Math.min(index, custom.length), 0, slot);
  return { ...figures, custom };
}

export function withoutCustomSlot(figures: FiguresData, id: string): FiguresData {
  return {
    ...figures,
    custom: figures.custom.filter((candidate: CustomSlot) => candidate.id !== id),
  };
}

/** Verschiebt ein eigenes Fach um eine Stelle; am Rand bleibt alles, wie es ist. */
export function withMovedCustomSlot(figures: FiguresData, id: string, offset: -1 | 1): FiguresData {
  const index: number = figures.custom.findIndex((candidate: CustomSlot) => candidate.id === id);
  const target: number = index + offset;
  const moved: CustomSlot | undefined = figures.custom[index];
  const neighbour: CustomSlot | undefined = figures.custom[target];
  if (index < 0 || moved === undefined || neighbour === undefined) {
    return figures;
  }
  const custom: CustomSlot[] = [...figures.custom];
  custom[index] = neighbour;
  custom[target] = moved;
  return { ...figures, custom };
}

/** Hat ein Fach ein Bild, aber keine Bewegung, bekommt es die passende; sonst bleibt alles gleich. */
export function withFittingMotion(figures: FiguresData, slot: string): FiguresData {
  const look: SlotLook | null = slotLook(figures, slot);
  if (look === null || look.image === null || look.motion !== 'none') {
    return figures;
  }
  const motion = isBuiltinSlotId(slot) ? FITTING_MOTION[slot] : 'bob';
  return withLook(figures, slot, { ...look, motion });
}

export function figuresSkinData(figures: FiguresData): SkinData {
  return { kind: 'figures', data: figures };
}

export function styleSkinData(style: StyleData): SkinData {
  return { kind: 'style', data: style };
}
