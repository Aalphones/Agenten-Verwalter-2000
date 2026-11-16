// Spiegel der Grenzen aus `src-tauri/src/skins/model.rs`: die Oberfläche prüft vor dem Speichern
// mit denselben Sätzen wie der Kern, der Kern bleibt die letzte Instanz.

export const MAX_CUSTOM_SLOTS = 24;
export const MAX_TEXTS = 10;
export const MAX_TEXT_CHARS = 160;
export const MAX_NAME_CHARS = 40;
export const MAX_PATTERN_CHARS = 200;
export const MAX_OPACITY = 60;

/** Zeichenzahl wie im Kern: Unicode-Zeichen, nicht UTF-16-Einheiten. */
function charCount(text: string): number {
  return Array.from(text).length;
}

/** Fehlersatz zu einem Namen; `what` ist das Subjekt des Satzes („Der Name eines Fachs“). */
export function nameError(name: string, what: string): string | null {
  const trimmed: string = name.trim();
  if (trimmed === '') {
    return `${what} darf nicht leer sein.`;
  }
  if (charCount(trimmed) > MAX_NAME_CHARS) {
    return `${what} darf höchstens ${String(MAX_NAME_CHARS)} Zeichen lang sein.`;
  }
  return null;
}

export function patternError(pattern: string, what: string): string | null {
  if (charCount(pattern.trim()) > MAX_PATTERN_CHARS) {
    return `${what} darf höchstens ${String(MAX_PATTERN_CHARS)} Zeichen lang sein.`;
  }
  return null;
}

export function toolsError(tools: string): string | null {
  if (tools.trim() === '') {
    return 'Ein eigenes Fach braucht ein Werkzeug-Muster.';
  }
  return patternError(tools, 'Das Werkzeug-Muster');
}

/** Ein Text je nicht leerer Zeile, getrimmt. */
export function parseTexts(raw: string): string[] {
  return raw
    .split('\n')
    .map((line: string) => line.trim())
    .filter((line: string) => line !== '');
}

export function textsError(raw: string): string | null {
  const texts: string[] = parseTexts(raw);
  if (texts.length > MAX_TEXTS) {
    return `Höchstens ${String(MAX_TEXTS)} Texte je Fach sind erlaubt.`;
  }
  if (texts.some((text: string) => charCount(text) > MAX_TEXT_CHARS)) {
    return `Ein Text darf höchstens ${String(MAX_TEXT_CHARS)} Zeichen lang sein.`;
  }
  return null;
}

export function customSlotCountError(count: number): string | null {
  return count >= MAX_CUSTOM_SLOTS
    ? `Höchstens ${String(MAX_CUSTOM_SLOTS)} eigene Fächer sind erlaubt.`
    : null;
}
