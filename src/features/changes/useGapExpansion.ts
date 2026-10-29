import { useState } from 'react';
import {
  revealRange,
  type Expansions,
  type GapDirection,
  type GapExpansion,
  type GapRow,
  type RevealedLine,
} from '@/features/changes/diffRows';
import type { DiffTarget } from '@/features/changes/useFileDiff';
import type { ChangeScope } from '@/lib/bindings/ChangeScope';
import type { ChangesReach } from '@/lib/bindings/ChangesReach';
import type { FileDiff } from '@/lib/bindings/FileDiff';
import type { FileLines } from '@/lib/bindings/FileLines';
import { loadFileLines } from '@/lib/changes';
import { commandErrorText } from '@/lib/errors';
import { highlightLines, plainLine, type SyntaxLine } from '@/lib/syntax';

/** Höchstzahl an Zeilen, die „Ganze Datei“ auf einmal holt — wie die Höchstzahl eines Diffs (ADR 006). */
const MAX_REVEALED_LINES = 20_000;
const CHANGED_TEXT = 'Die Datei hat sich seit dem Diff geändert.';

/** Eine Lücke (ihre Kennung) oder alle Lücken zugleich über „Ganze Datei“. */
export type GapTarget = number | 'all';

export interface GapError {
  gap: GapTarget;
  text: string;
}

export interface GapExpansionState {
  expansions: Expansions;
  /** Was gerade lädt; solange startet kein zweites Nachladen. */
  busyGap: GapTarget | null;
  /** Der letzte Fehler beim Nachladen; das nächste Nachladen löscht ihn. */
  errorGap: GapError | null;
  expand: (gap: GapRow, direction: GapDirection) => void;
  /** Füllt alle Lücken mit einem Aufruf; `gaps` sind die Balken in der Reihenfolge der Datei. */
  expandAll: (gaps: readonly GapRow[]) => void;
  collapseAll: () => void;
}

interface ExpansionState {
  /** Der Diff, für den die Aufklappungen gelten; ein neu geladener Diff beginnt ohne. */
  diff: FileDiff | null;
  expansions: Expansions;
  busyGap: GapTarget | null;
  errorGap: GapError | null;
}

const NO_EXPANSIONS: Expansions = new Map<number, GapExpansion>();
const NO_EXPANSION: GapExpansion = { head: [], tail: [] };

function initialState(diff: FileDiff | null): ExpansionState {
  return { diff, expansions: NO_EXPANSIONS, busyGap: null, errorGap: null };
}

/** Eingeblendete unveränderte Zeilen je Lücke für genau einen Diff (ADR 043). Lädt `diff` neu, sind alle
 *  Aufklappungen weg — abgeleitet aus dem gemerkten Diff, ohne Effekt. */
export function useGapExpansion(
  sessionId: string,
  reach: ChangesReach,
  file: DiffTarget,
  scope: ChangeScope,
  diff: FileDiff | null,
  language: string | null,
): GapExpansionState {
  const [stored, setStored] = useState<ExpansionState>(() => initialState(diff));
  const state: ExpansionState = stored.diff === diff ? stored : initialState(diff);

  /** `reveal` baut aus den geladenen Zeilen die neuen Aufklappungen; `null` heißt, sie passen nicht mehr zum Diff. */
  function load(
    target: GapTarget,
    from: number,
    to: number,
    reveal: (expansions: Expansions, lines: readonly RevealedLine[]) => Expansions | null,
  ): void {
    if (state.busyGap !== null) {
      return;
    }
    const loadedFor: FileDiff | null = diff;
    setStored({ ...state, busyGap: target, errorGap: null });
    loadFileLines(sessionId, reach, file.key, file.path, scope, from, to)
      .then((loaded: FileLines) => {
        const lines: RevealedLine[] = revealedLines(loaded.lines, from, language);
        setStored((current: ExpansionState) => {
          if (current.diff !== loadedFor) {
            return current;
          }
          const next: Expansions | null = reveal(current.expansions, lines);
          if (next === null) {
            return { ...current, busyGap: null, errorGap: { gap: target, text: CHANGED_TEXT } };
          }
          return { ...current, expansions: next, busyGap: null };
        });
      })
      .catch((reason: unknown) => {
        setStored((current: ExpansionState) => {
          if (current.diff !== loadedFor) {
            return current;
          }
          return {
            ...current,
            busyGap: null,
            errorGap: { gap: target, text: commandErrorText(reason) },
          };
        });
      });
  }

  function expand(gap: GapRow, direction: GapDirection): void {
    const range: { from: number; to: number } = revealRange(gap, direction);
    load(gap.id, range.from, range.to, (expansions: Expansions, lines: readonly RevealedLine[]) => {
      const current: GapExpansion = expansions.get(gap.id) ?? NO_EXPANSION;
      if (direction === 'up') {
        // Die Endzeilen müssen lückenlos an den Abschnitt darunter anschließen.
        if (lines.length !== range.to - range.from + 1) {
          return null;
        }
        return new Map(expansions).set(gap.id, {
          head: current.head,
          tail: [...lines, ...current.tail],
        });
      }
      if (lines.length === 0) {
        return null;
      }
      return new Map(expansions).set(gap.id, {
        head: [...current.head, ...lines],
        tail: current.tail,
      });
    });
  }

  function expandAll(gaps: readonly GapRow[]): void {
    const first: GapRow | undefined = gaps[0];
    const last: GapRow | undefined = gaps[gaps.length - 1];
    if (first === undefined || last === undefined) {
      return;
    }
    const from: number = first.from;
    const to: number = Math.min(last.to, from + MAX_REVEALED_LINES - 1);
    // Ein Block über alle Lücken samt der Abschnitte dazwischen: gefärbt wird er als zusammenhängender Text.
    load('all', from, to, (expansions: Expansions, lines: readonly RevealedLine[]) => {
      if (lines.length === 0) {
        return null;
      }
      const next = new Map(expansions);
      for (const gap of gaps) {
        const covered: readonly RevealedLine[] = lines.slice(gap.from - from, gap.to - from + 1);
        if (covered.length > 0) {
          const current: GapExpansion = next.get(gap.id) ?? NO_EXPANSION;
          next.set(gap.id, { head: [...current.head, ...covered], tail: current.tail });
        }
      }
      return next;
    });
  }

  function collapseAll(): void {
    if (state.busyGap !== null) {
      return;
    }
    setStored(initialState(diff));
  }

  return {
    expansions: state.expansions,
    busyGap: state.busyGap,
    errorGap: state.errorGap,
    expand,
    expandAll,
    collapseAll,
  };
}

/** Färbt einen geladenen Block als zusammenhängenden Text; die erste Zeile hat die Nummer `from`. */
function revealedLines(
  texts: readonly string[],
  from: number,
  language: string | null,
): RevealedLine[] {
  const highlighted: SyntaxLine[] = highlightLines(texts.join('\n'), language);
  return texts.map((text: string, index: number) => ({
    line: from + index,
    text,
    segments: highlighted[index] ?? plainLine(text),
  }));
}
