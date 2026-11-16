/** Die Tipps, die eine neue Session zeigt, wenn ein Figurenpaket aktiv ist. */
export const TIPS: readonly string[] = [
  'Strg+; öffnet eine Nebenfrage, ohne die Session zu stören.',
  'Esc unterbricht den Agenten, die Session bleibt.',
  '/btw stellt eine Frage am Rand.',
  'Im Reiter Artefakte siehst du alles, was der Agent dir zeigen will.',
  'Rechtsklick auf markierten Text im Chat öffnet eine Nebenfrage dazu.',
];

/** Easter Egg am 4. Mai: ersetzt den Tipp. */
export const MAY_FOURTH_LINE = 'Möge die Macht mit dir sein.';

/** Easter Egg bei Session Nummer 42. */
export const SESSION_42_LINE = 'Session 42 – die Antwort auf fast alles.';

const SESSION_42 = 42;
const MAY = 4;
const FOURTH = 4;

/** Ob das lokale Datum der 4. Mai ist. */
export function isMayFourth(date: Date): boolean {
  return date.getMonth() + 1 === MAY && date.getDate() === FOURTH;
}

/** Ob die Session Nummer 42 trägt. */
export function isSession42(number: number): boolean {
  return number === SESSION_42;
}

/**
 * Der Tipp zum Datum: am 4. Mai der Gruß (nur mit `isEasterEggs`), sonst ein zufälliger Tipp.
 * `roll` (0 bis 1) wählt den Tipp; ohne Angabe wird gewürfelt.
 */
export function pickTip(date: Date, isEasterEggs: boolean, roll: number = Math.random()): string {
  if (isEasterEggs && isMayFourth(date)) {
    return MAY_FOURTH_LINE;
  }
  const index: number = Math.min(TIPS.length - 1, Math.floor(roll * TIPS.length));
  return TIPS[index] ?? '';
}

/** Der Name der Figur: der Paketname ohne Klammerzusatz („Pokémon (Kanto)“ → „Pokémon“). */
export function figureName(packName: string): string {
  const stripped: string = packName.replace(/\s*\([^)]*\)\s*$/, '').trim();
  return stripped === '' ? packName.trim() : stripped;
}
