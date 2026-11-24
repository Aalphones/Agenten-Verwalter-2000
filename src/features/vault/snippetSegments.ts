const MARK_START = '';
const MARK_END = '';

export interface SnippetSegment {
  text: string;
  isMatch: boolean;
}

/** Zerlegt einen Ausschnitt des Cores an den Zeichen für Anfang und Ende einer Fundstelle. */
export function snippetSegments(snippet: string): SnippetSegment[] {
  const segments: SnippetSegment[] = [];
  let isMatch = false;
  let current = '';
  for (const character of snippet) {
    if (character === MARK_START || character === MARK_END) {
      if (current !== '') {
        segments.push({ text: current, isMatch });
        current = '';
      }
      isMatch = character === MARK_START;
    } else {
      current += character;
    }
  }
  if (current !== '') {
    segments.push({ text: current, isMatch });
  }
  return segments;
}

/** Zerlegt einen Text so, dass jeder Wortanfang eines Suchbegriffs eine Fundstelle ist — für Titel und
 *  Beschreibung, die der Core nicht markiert. */
export function highlightSegments(text: string, query: string): SnippetSegment[] {
  const terms: string[] = query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((term: string) => term !== '');
  if (terms.length === 0) {
    return [{ text, isMatch: false }];
  }
  // Begriffe bestehen nur aus Buchstaben und Ziffern und brauchen keine Maskierung.
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])(?:${terms.join('|')})[\\p{L}\\p{N}]*`, 'giu');
  const segments: SnippetSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) {
      segments.push({ text: text.slice(last, match.index), isMatch: false });
    }
    segments.push({ text: match[0], isMatch: true });
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    segments.push({ text: text.slice(last), isMatch: false });
  }
  return segments;
}
