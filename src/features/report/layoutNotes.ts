/** Eine Randnotiz vor dem Setzen: Höhe der Zeile, an der sie hängt, und ihre eigene Höhe. */
export interface NoteBox {
  anchorTop: number;
  height: number;
}

export interface NoteLayout {
  /** Oberkante je Notiz, in der Reihenfolge der Eingabe. */
  tops: number[];
  /** Höhe der Randspalte, damit auch die letzte Notiz Platz hat. */
  height: number;
}

/** Setzt die Randnotizen auf die Höhe ihrer Zeile und schiebt jede unter die vorige, wenn sich zwei überlappen.
 *  Die Eingabe ist nach Zeile sortiert; `gap` ist der Abstand zwischen zwei Notizen. */
export function layoutNotes(boxes: readonly NoteBox[], gap: number): NoteLayout {
  const tops: number[] = [];
  let bottom = Number.NEGATIVE_INFINITY;
  for (const box of boxes) {
    const top: number = Math.max(box.anchorTop, bottom + gap);
    tops.push(top);
    bottom = top + box.height;
  }
  return { tops, height: Math.max(bottom, 0) };
}
