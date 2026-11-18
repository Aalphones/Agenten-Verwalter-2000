import { hunkRange } from '@/features/changes/diffRows';
import type { FileDiff } from '@/lib/bindings/FileDiff';

/** Welche Zeilen der ganzen Datei der Diff „Gesamt“ berührt. */
export interface ChangedLines {
  /** Nummern der Zeilen, die der Diff als hinzugefügt führt. */
  added: ReadonlySet<number>;
  /** Nummern der Zeilen, vor denen der Diff Zeilen entfernt. */
  removedBefore: ReadonlySet<number>;
  /** Anfang jeder markierten Stelle (zusammenhängende Zeilen zählen als eine), aufsteigend. */
  starts: readonly number[];
}

/** Liest aus einem Diff, welche Zeilen der neuen Fassung neu sind und wo Entferntes fehlt. */
export function changedLines(diff: FileDiff): ChangedLines {
  const added = new Set<number>();
  const removedBefore = new Set<number>();
  // Nummer der Zeile, die auf die zuletzt gelesene neue Zeile folgt: dort fehlt, was eine gelöschte Zeile entfernt.
  let nextNew = 1;
  for (const line of diff.lines) {
    if (line.kind === 'hunk') {
      nextNew = hunkRange(line.text)?.firstNew ?? nextNew;
    } else if (line.kind === 'deleted') {
      removedBefore.add(nextNew);
    } else if (line.newLine !== null) {
      if (line.kind === 'added') {
        added.add(line.newLine);
      }
      nextNew = line.newLine + 1;
    }
  }
  const marked: number[] = [...new Set([...added, ...removedBefore])].sort(
    (first: number, second: number) => first - second,
  );
  const markedSet = new Set<number>(marked);
  const starts: number[] = marked.filter((line: number) => !markedSet.has(line - 1));
  return { added, removedBefore, starts };
}
