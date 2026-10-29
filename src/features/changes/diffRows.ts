import type { FileDiff } from '@/lib/bindings/FileDiff';
import type { SyntaxLine } from '@/lib/syntax';

/** So viele Zeilen holt ein Pfeil im Balken (Annahme, für Bitbucket Cloud nicht belegt). */
const REVEAL_STEP = 20;

export type GapPosition = 'top' | 'middle' | 'bottom';

/** Pfeil nach unten, Pfeil nach oben oder der Text im Balken (die ganze Lücke). */
export type GapDirection = 'down' | 'up' | 'all';

export type DiffRow =
  | { kind: 'line'; index: number } // Zeile aus diff.lines, nie ein Abschnittskopf
  | { kind: 'revealed'; line: number; oldLine: number; text: string; segments: SyntaxLine }
  | { kind: 'gap'; id: number; from: number; to: number; delta: number; position: GapPosition }
  | { kind: 'truncated' }; // Kürzungs-Meldung wie bisher

/** Ein Balken: `id` ist das ursprüngliche `from` der Lücke, `from`/`to` sind die noch versteckten Zeilen der neuen
 *  Fassung, alte Nummer = neue + `delta`. */
export type GapRow = Extract<DiffRow, { kind: 'gap' }>;

/** Eine eingeblendete unveränderte Zeile; `line` ist die Nummer in der neuen Fassung. */
export interface RevealedLine {
  line: number;
  text: string;
  segments: SyntaxLine;
}

/** Eingeblendete Zeilen einer Lücke: `head` schließt an die Änderung darüber an, `tail` an die darunter. */
export interface GapExpansion {
  head: readonly RevealedLine[];
  tail: readonly RevealedLine[];
}

/** Je Lücken-Kennung die eingeblendeten Zeilen. */
export type Expansions = ReadonlyMap<number, GapExpansion>;

/** Nummern eines Abschnitts; hat eine Seite keine Zeilen, ist ihr `last` = `first` − 1. */
export interface HunkRange {
  firstOld: number;
  lastOld: number;
  firstNew: number;
  lastNew: number;
}

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

/** Vor dem ersten Abschnitt: die Lücke davor beginnt bei Zeile 1. */
const FILE_START: HunkRange = { firstOld: 0, lastOld: 0, firstNew: 0, lastNew: 0 };

/** Liest `@@ -a,b +c,d @@`; eine fehlende Anzahl ist 1 (Git lässt sie dann weg). `null`, wenn der Kopf nicht lesbar
 *  ist. Bei `b = 0` bzw. `d = 0` nennt Git die Zeile davor, deshalb beginnt die Seite eins dahinter. */
export function hunkRange(text: string): HunkRange | null {
  const match: RegExpExecArray | null = HUNK_HEADER.exec(text);
  if (match === null) {
    return null;
  }
  const [, oldStart, oldCount, newStart, newCount] = match;
  if (oldStart === undefined || newStart === undefined) {
    return null;
  }
  const oldLength: number = countOf(oldCount);
  const newLength: number = countOf(newCount);
  const firstOld: number = oldLength === 0 ? Number(oldStart) + 1 : Number(oldStart);
  const firstNew: number = newLength === 0 ? Number(newStart) + 1 : Number(newStart);
  return {
    firstOld,
    lastOld: firstOld + oldLength - 1,
    firstNew,
    lastNew: firstNew + newLength - 1,
  };
}

/**
 * Die Zeilen der Ansicht: Diff-Zeilen ohne Abschnittsköpfe; an der Stelle jedes Kopfs und nach dem letzten Abschnitt
 * die Lücke davor als Balken, eingeblendete Anfangszeilen davor, eingeblendete Endzeilen dahinter. Ein unlesbarer
 * Kopf nimmt der Lücke vor und nach seinem Abschnitt den Balken. Nach dem letzten Abschnitt gibt es nur einen Balken,
 * wenn die Zeilenzahl bekannt und der Diff nicht gekürzt ist.
 */
export function buildRows(diff: FileDiff, expansions: Expansions): DiffRow[] {
  const rows: DiffRow[] = [];
  let previous: HunkRange | null = FILE_START;
  for (const [index, line] of diff.lines.entries()) {
    if (line.kind !== 'hunk') {
      rows.push({ kind: 'line', index });
      continue;
    }
    const range: HunkRange | null = hunkRange(line.text);
    if (range !== null && previous !== null) {
      const from: number = previous.lastNew + 1;
      appendGap(rows, expansions, {
        kind: 'gap',
        id: from,
        from,
        to: range.firstNew - 1,
        delta: range.firstOld - range.firstNew,
        position: previous === FILE_START ? 'top' : 'middle',
      });
    }
    previous = range;
  }
  if (
    previous !== null &&
    previous !== FILE_START &&
    diff.newLineCount !== null &&
    !diff.truncated
  ) {
    const from: number = previous.lastNew + 1;
    appendGap(rows, expansions, {
      kind: 'gap',
      id: from,
      from,
      to: diff.newLineCount,
      delta: previous.lastOld - previous.lastNew,
      position: 'bottom',
    });
  }
  if (diff.truncated) {
    rows.push({ kind: 'truncated' });
  }
  return rows;
}

/** Welche Zeilen ein Klick holt: Pfeil nach unten bis zu 20 am Anfang, Pfeil nach oben bis zu 20 am Ende, der Text
 *  alles. Ist der Rest kleiner, holt der Pfeil den ganzen Rest. */
export function revealRange(gap: GapRow, direction: GapDirection): { from: number; to: number } {
  switch (direction) {
    case 'down':
      return { from: gap.from, to: Math.min(gap.to, gap.from + REVEAL_STEP - 1) };
    case 'up':
      return { from: Math.max(gap.from, gap.to - REVEAL_STEP + 1), to: gap.to };
    case 'all':
      return { from: gap.from, to: gap.to };
  }
}

/** Schlüssel für die virtualisierte Liste: bleibt einer Zeile, wenn davor Zeilen eingeblendet werden, damit gemessene
 *  Höhen und die Scrollposition an der richtigen Zeile hängen. */
export function rowKey(row: DiffRow): string {
  switch (row.kind) {
    case 'line':
      return `line-${String(row.index)}`;
    case 'revealed':
      return `revealed-${String(row.line)}`;
    case 'gap':
      return `gap-${String(row.id)}`;
    case 'truncated':
      return 'truncated';
  }
}

function countOf(digits: string | undefined): number {
  if (digits === undefined) {
    return 1;
  }
  return Number(digits);
}

/** Hängt die Lücke an, sofern sie Zeilen hat: eingeblendete Anfangszeilen, den Balken für den Rest, eingeblendete
 *  Endzeilen. Ist alles eingeblendet, entfällt der Balken. */
function appendGap(rows: DiffRow[], expansions: Expansions, gap: GapRow): void {
  if (gap.to < gap.from) {
    return;
  }
  const expansion: GapExpansion | undefined = expansions.get(gap.id);
  const head: readonly RevealedLine[] = expansion?.head ?? [];
  const tail: readonly RevealedLine[] = expansion?.tail ?? [];
  for (const revealed of head) {
    rows.push(revealedRow(revealed, gap.delta));
  }
  const from: number = gap.from + head.length;
  const to: number = gap.to - tail.length;
  if (from <= to) {
    rows.push({ ...gap, from, to });
  }
  for (const revealed of tail) {
    rows.push(revealedRow(revealed, gap.delta));
  }
}

function revealedRow(revealed: RevealedLine, delta: number): DiffRow {
  return {
    kind: 'revealed',
    line: revealed.line,
    oldLine: revealed.line + delta,
    text: revealed.text,
    segments: revealed.segments,
  };
}
