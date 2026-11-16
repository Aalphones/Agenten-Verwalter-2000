import { BUILTIN_TOOL_SLOTS } from '@/features/skins/slotCatalog';

/** Ein eigenes Fach eines Figurenpakets, soweit es für das Zuordnen zählt. */
export interface CustomSlotMatch {
  id: string;
  /** Muster für den Werkzeugnamen, durch Komma getrennt (`*` und `?` als Platzhalter). */
  tools: string;
  /** Muster für das Ziel des Aufrufs; `null` = egal. */
  input: string | null;
}

const REGEXP_SPECIAL_CHARS = /[.+^${}()|[\]\\]/g;

/** `*` steht für beliebig viele Zeichen, `?` für eines; Groß-/Kleinschreibung zählt nicht. */
export function globToRegExp(pattern: string): RegExp {
  let source = '';
  for (const char of pattern) {
    if (char === '*') {
      source += '.*';
    } else if (char === '?') {
      source += '.';
    } else {
      source += char.replace(REGEXP_SPECIAL_CHARS, '\\$&');
    }
  }
  return new RegExp(`^${source}$`, 'i');
}

/** Passt `text` auf mindestens eines der durch Komma getrennten Muster? Leere Teile zählen nicht. */
export function matchesAny(patterns: string, text: string): boolean {
  return patterns
    .split(',')
    .map((pattern: string) => pattern.trim())
    .filter((pattern: string) => pattern.length > 0)
    .some((pattern: string) => globToRegExp(pattern).test(text));
}

/** Das Fach eines Aufrufs: das erste passende eigene Fach, sonst das mitgelieferte. */
export function slotFor(tool: string, target: string, custom: readonly CustomSlotMatch[]): string {
  for (const slot of custom) {
    if (!matchesAny(slot.tools, tool)) {
      continue;
    }
    if (slot.input !== null && !matchesAny(slot.input, target)) {
      continue;
    }
    return slot.id;
  }
  return BUILTIN_TOOL_SLOTS[tool] ?? 'other';
}
