import { fillText } from '@/features/skins/fillText';
import { BUILTIN_SLOT_IDS, IDLE_TEXT, PLAIN_TEXTS } from '@/features/skins/slotCatalog';
import type { BuiltinSlotId } from '@/features/skins/slotCatalog';
import type { SlotLook } from '@/lib/bindings/SlotLook';

export interface StatusTextInput {
  /** Das gezeigte Fach; `null` = noch keines, dann der neutrale Text. */
  slot: string | null;
  /** Ziel des Werkzeugs für `{ziel}`. */
  target: string;
  /** Beim Denken: welcher Text steht (der letzte bleibt stehen); sonst `null`. */
  textIndex: number | null;
  /** Zufallswert (0 bis 1), gezogen beim Wechsel; wählt den Text, solange kein Index gilt. */
  roll: number;
  /** Das Fach im aktiven Figurenpaket; `null` ohne Paket oder ohne Eintrag. */
  look: SlotLook | null;
  /** Laufende Dauer `m:ss` für `{zeit}`. */
  time: string;
}

function isBuiltinSlot(slot: string): slot is BuiltinSlotId {
  return (BUILTIN_SLOT_IDS as readonly string[]).includes(slot);
}

/** Der sachliche Text des Fachs; ein eigenes Fach ohne Text fällt auf „Sonstiges“ zurück. */
function plainTemplate(slot: string): string {
  return isBuiltinSlot(slot) ? PLAIN_TEXTS[slot] : PLAIN_TEXTS.other;
}

function pickTemplate(input: StatusTextInput, slot: string): string {
  const texts: readonly string[] = (input.look?.texts ?? []).filter(
    (text: string) => text.trim() !== '',
  );
  if (texts.length === 0) {
    return plainTemplate(slot);
  }
  const index: number =
    input.textIndex === null
      ? Math.min(texts.length - 1, Math.floor(input.roll * texts.length))
      : Math.min(texts.length - 1, input.textIndex);
  return texts[index] ?? plainTemplate(slot);
}

const SECONDS_PER_MINUTE = 60;

/** Dauer als `m:ss` für `{zeit}`. */
export function formatElapsed(totalSeconds: number): string {
  const minutes: number = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
  const seconds: number = totalSeconds % SECONDS_PER_MINUTE;
  return `${String(minutes)}:${String(seconds).padStart(2, '0')}`;
}

/** Der Text der Statuszeile: aus dem Paket, sonst sachlich, mit eingesetztem Ziel, Zeit und Commit. */
export function statusText(input: StatusTextInput): string {
  if (input.slot === null) {
    return IDLE_TEXT;
  }
  return fillText(pickTemplate(input, input.slot), {
    ziel: input.target,
    zeit: input.time,
    commit: '',
  });
}

/** Text einer Feier-Meldung (Fach `commit` oder `station`) mit eingesetzter Kurzkennung. */
export function celebrationText(
  look: SlotLook | null,
  slot: BuiltinSlotId,
  commit: string,
): string {
  const input: StatusTextInput = {
    slot,
    target: '',
    textIndex: null,
    roll: Math.random(),
    look,
    time: '',
  };
  return fillText(pickTemplate(input, slot), { ziel: '', zeit: '', commit });
}
