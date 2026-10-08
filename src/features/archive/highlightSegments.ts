export interface HighlightSegment {
  text: string;
  isMatch: boolean;
}

interface LoweredText {
  lowered: string;
  /** Je Zeichen von `lowered` der Anfang des Ursprungszeichens in `text`. */
  originStarts: number[];
  /** Je Zeichen von `lowered` das Ende des Ursprungszeichens in `text`. */
  originEnds: number[];
}

/** Kleinschreibung mit Rückverweis: Unicode-Kleinschreibung kann die Länge ändern („İ“ wird zu zwei Zeichen),
 *  ein Index in `lowered` ist dann nicht mehr ein Index in `text`. */
function lowerWithOrigins(text: string): LoweredText {
  let lowered = '';
  const originStarts: number[] = [];
  const originEnds: number[] = [];
  let position = 0;
  for (const character of text) {
    const piece: string = character.toLowerCase();
    for (let offset = 0; offset < piece.length; offset += 1) {
      originStarts.push(position);
      originEnds.push(position + character.length);
    }
    lowered += piece;
    position += character.length;
  }
  return { lowered, originStarts, originEnds };
}

/** Teilt `text` in Abschnitte, die den Suchbegriff (Unicode-Groß/Klein egal, Rand getrimmt wie im Core) treffen
 *  oder nicht. Ohne Begriff bleibt der Text ein einziger Abschnitt. */
export function highlightSegments(text: string, query: string): HighlightSegment[] {
  const term: string = query.trim().toLowerCase();
  if (term === '') {
    return [{ text, isMatch: false }];
  }
  const { lowered, originStarts, originEnds }: LoweredText = lowerWithOrigins(text);
  const segments: HighlightSegment[] = [];
  let copied = 0;
  let searchFrom = 0;
  for (;;) {
    const matchStart: number = lowered.indexOf(term, searchFrom);
    if (matchStart < 0) {
      break;
    }
    const matchEnd: number = matchStart + term.length;
    const start: number | undefined = originStarts[matchStart];
    const end: number | undefined = originEnds[matchEnd - 1];
    if (start === undefined || end === undefined) {
      break;
    }
    searchFrom = matchEnd;
    // Zwei Treffer können im selben Ursprungszeichen enden und beginnen — der zweite hätte nichts Eigenes mehr.
    if (end <= copied) {
      continue;
    }
    const markStart: number = Math.max(start, copied);
    if (markStart > copied) {
      segments.push({ text: text.slice(copied, markStart), isMatch: false });
    }
    segments.push({ text: text.slice(markStart, end), isMatch: true });
    copied = end;
  }
  if (copied < text.length) {
    segments.push({ text: text.slice(copied), isMatch: false });
  }
  return segments;
}
