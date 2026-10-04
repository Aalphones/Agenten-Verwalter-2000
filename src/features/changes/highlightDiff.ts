import type { DiffLine } from '@/lib/bindings/DiffLine';
import { highlightLines, plainLine, type SyntaxLine } from '@/lib/syntax';

/**
 * Färbt die Zeilen eines Diffs; Ergebnis hat die Länge und Reihenfolge von `lines`.
 * Gefärbt wird je Abschnitt (zwischen zwei `@@`-Köpfen) die alte und die neue Seite
 * als zusammenhängender Text, damit mehrzeilige Kommentare und Strings über alle
 * ihre Zeilen gefärbt sind.
 */
export function highlightDiff(lines: readonly DiffLine[], language: string | null): SyntaxLine[] {
  const highlighted: SyntaxLine[] = [];
  let section: DiffLine[] = [];
  for (const line of lines) {
    if (line.kind === 'hunk') {
      appendSection(highlighted, section, language);
      section = [];
      highlighted.push(plainLine(line.text));
    } else {
      section.push(line);
    }
  }
  appendSection(highlighted, section, language);
  return highlighted;
}

function appendSection(
  output: SyntaxLine[],
  section: readonly DiffLine[],
  language: string | null,
): void {
  if (section.length === 0) {
    return;
  }
  const oldSide: SyntaxLine[] = highlightLines(
    section
      .filter((line: DiffLine) => line.kind !== 'added')
      .map((line: DiffLine) => line.text)
      .join('\n'),
    language,
  );
  const newSide: SyntaxLine[] = highlightLines(
    section
      .filter((line: DiffLine) => line.kind !== 'deleted')
      .map((line: DiffLine) => line.text)
      .join('\n'),
    language,
  );
  let oldIndex = 0;
  let newIndex = 0;
  for (const line of section) {
    if (line.kind === 'deleted') {
      output.push(oldSide[oldIndex] ?? plainLine(line.text));
      oldIndex += 1;
    } else if (line.kind === 'added') {
      output.push(newSide[newIndex] ?? plainLine(line.text));
      newIndex += 1;
    } else {
      output.push(newSide[newIndex] ?? plainLine(line.text));
      oldIndex += 1;
      newIndex += 1;
    }
  }
}
