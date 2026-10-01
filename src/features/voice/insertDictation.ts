/** Stand des Textfelds beim Start des Diktats: Text und Auswahl (`start` = `end` bei bloßem Cursor). */
export interface DictationBase {
  value: string;
  start: number;
  end: number;
}

export interface DictationInsertion {
  value: string;
  /** Cursorposition hinter dem eingefügten Text. */
  caret: number;
}

/** Setzt den erkannten Text anstelle der Auswahl des Ausgangsstands ein, mit je einem Leerzeichen zu den
 *  Nachbarn, wo dort kein Leerraum steht. Rechnet immer vom Ausgangsstand aus: ein neuerer Zwischenstand ersetzt
 *  den älteren, statt ihn zu ergänzen. */
export function insertDictation(base: DictationBase, text: string): DictationInsertion {
  const start: number = Math.min(Math.max(base.start, 0), base.value.length);
  const end: number = Math.min(Math.max(base.end, start), base.value.length);
  const before: string = base.value.slice(0, start);
  const after: string = base.value.slice(end);
  const leading: string = before !== '' && !/\s$/.test(before) ? ' ' : '';
  const trailing: string = after !== '' && !/^\s/.test(after) ? ' ' : '';
  const inserted: string = `${leading}${text}${trailing}`;
  return { value: `${before}${inserted}${after}`, caret: before.length + inserted.length };
}
