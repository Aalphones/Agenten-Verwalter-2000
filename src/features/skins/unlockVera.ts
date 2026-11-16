import type { BuiltinSlot } from '@/lib/bindings/BuiltinSlot';
import type { SkinPackSummary } from '@/lib/bindings/SkinPackSummary';
import { createSkin, listSkins, saveSkin } from '@/lib/skins';

const VERA_NAME = 'Vera';

/** Texte des Pakets „Vera“ (nur Texte, keine Bilder). */
const VERA_TEXTS: readonly (readonly [BuiltinSlot, string[]])[] = [
  ['search', ['Vera durchsucht {ziel}. Gnadenlos.']],
  ['read', ['Vera liest {ziel}. Du solltest dir Sorgen machen.']],
  ['write', ['Vera räumt {ziel} hinter dir auf.']],
  ['shell', ['Vera tippt „{ziel}“ schneller, als du denkst.']],
  ['think', ['Vera denkt nach. Bitte nicht stören.']],
  ['commit', ['Commit {commit} steht. Gern geschehen, Sonnenschein.']],
];

/**
 * Die ID des Pakets „Vera“. Gibt es noch keines, wird es angelegt und mit den Texten gefüllt;
 * ein vorhandenes Paket gleichen Namens bleibt unverändert.
 */
export async function ensureVera(): Promise<string> {
  const existing: SkinPackSummary | undefined = (await listSkins()).find(
    (pack: SkinPackSummary) => pack.kind === 'figures' && pack.name === VERA_NAME,
  );
  if (existing !== undefined) {
    return existing.id;
  }
  const created = await createSkin('figures', VERA_NAME, null);
  await saveSkin(created.id, {
    kind: 'figures',
    data: {
      custom: [],
      builtin: VERA_TEXTS.map(([slot, texts]) => ({
        slot,
        look: { image: null, image2: null, motion: 'none', texts },
      })),
    },
  });
  return created.id;
}
