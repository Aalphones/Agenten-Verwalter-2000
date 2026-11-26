export type LineToSend = { kind: 'ok'; line: string } | { kind: 'multiline' } | { kind: 'empty' };

const LINE_BREAKS = /[\r\n]/;
const EDGE_LINE_BREAKS = /^[\r\n]+|[\r\n]+$/g;

/** Wählt, was „Ins Terminal“ sendet: die Auswahl, ohne Auswahl die ganze Zeile unter dem Cursor.
 *  Zeilenenden am Rand fallen weg; ein Umbruch mitten in der Auswahl sperrt, weil die Shell jede Zeile
 *  einzeln ausführen würde. */
export function lineToSend(text: string, selectionStart: number, selectionEnd: number): LineToSend {
  const raw: string =
    selectionStart === selectionEnd
      ? wholeLineAt(text, selectionStart)
      : text.slice(selectionStart, selectionEnd);
  const line: string = raw.replace(EDGE_LINE_BREAKS, '');
  if (LINE_BREAKS.test(line)) {
    return { kind: 'multiline' };
  }
  if (line.trim() === '') {
    return { kind: 'empty' };
  }
  return { kind: 'ok', line };
}

function wholeLineAt(text: string, position: number): string {
  const lineStart: number = Math.max(
    text.lastIndexOf('\n', position - 1),
    text.lastIndexOf('\r', position - 1),
  );
  const nextBreaks: number[] = [text.indexOf('\n', position), text.indexOf('\r', position)].filter(
    (index: number) => index >= 0,
  );
  const lineEnd: number = nextBreaks.length === 0 ? text.length : Math.min(...nextBreaks);
  return text.slice(lineStart + 1, lineEnd);
}
