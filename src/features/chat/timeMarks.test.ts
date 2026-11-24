/// <reference types="node" />
// `describe` und `it` von node:test liefern Promises, die der Testlauf selbst einsammelt.
/* eslint-disable @typescript-eslint/no-floating-promises */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ChatBlock, TextEntry, ToolEntry } from './buildBlocks';
import { blockAt, buildTimeMarks, formatDay, formatGap, type BlockTime } from './timeMarks';

const MINUTE = 60_000;
const NOW: number = new Date(2026, 10, 23, 12, 0, 0).getTime();

function at(day: number, hour: number, minute: number, second = 0): number {
  return new Date(2026, 10, day, hour, minute, second).getTime();
}

function textBlock(seq: number, time: number | null): ChatBlock {
  const entry: TextEntry = { kind: 'text', seq, at: time, text: 'Antwort', unsourced: [] };
  return { kind: 'entry', key: String(seq), entry };
}

function userBlock(seq: number, sentAt: number): ChatBlock {
  return {
    kind: 'entry',
    key: String(seq),
    entry: { kind: 'user', seq, text: 'Frage', sentAt, attachments: [], skill: null, comments: [] },
  };
}

function toolEntry(seq: number, time: number | null): ToolEntry {
  return {
    kind: 'tool',
    seq,
    at: time,
    toolUseId: `tool-${String(seq)}`,
    tool: 'Read',
    target: 'datei.ts',
    state: 'done',
    description: null,
  };
}

function toolsBlock(tools: ToolEntry[], purpose: TextEntry | null = null): ChatBlock {
  return { kind: 'tools', key: String(tools[0]?.seq ?? 0), tools, purpose };
}

function marksOf(blocks: ChatBlock[]): BlockTime[] {
  return buildTimeMarks(blocks, NOW);
}

describe('blockAt', () => {
  it('nimmt bei Nachrichten des Nutzers sentAt', () => {
    assert.equal(blockAt(userBlock(0, 5)), 5);
  });

  it('nimmt bei Werkzeug-Blöcken die Zeit des ersten Aufrufs', () => {
    assert.equal(blockAt(toolsBlock([toolEntry(1, 10), toolEntry(2, 99)])), 10);
  });

  it('fällt ohne Zeit des ersten Aufrufs auf die Zweckzeile zurück', () => {
    const purpose: TextEntry = { kind: 'text', seq: 0, at: 7, text: 'Lese', unsourced: [] };
    assert.equal(blockAt(toolsBlock([toolEntry(1, null)], purpose)), 7);
  });

  it('liefert null für Einträge ohne Zeit', () => {
    assert.equal(blockAt(textBlock(0, null)), null);
  });
});

describe('buildTimeMarks: Minuten', () => {
  it('zeigt die Zeit nur am ersten Block je Minute', () => {
    const marks: BlockTime[] = marksOf([
      textBlock(0, at(23, 9, 47, 5)),
      textBlock(1, at(23, 9, 47, 50)),
      textBlock(2, at(23, 9, 48, 1)),
    ]);
    assert.deepEqual(
      marks.map((mark: BlockTime) => mark.showsTime),
      [true, false, true],
    );
  });

  it('prüft gegen den letzten Block mit Zeit, auch über einen Block ohne Zeit hinweg', () => {
    const marks: BlockTime[] = marksOf([
      textBlock(0, at(23, 9, 47, 5)),
      textBlock(1, null),
      textBlock(2, at(23, 9, 47, 40)),
    ]);
    assert.deepEqual(
      marks.map((mark: BlockTime) => mark.showsTime),
      [true, false, false],
    );
  });

  it('zeigt dieselbe Minute an einem anderen Tag erneut', () => {
    const marks: BlockTime[] = marksOf([textBlock(0, at(22, 9, 47)), textBlock(1, at(23, 9, 47))]);
    assert.equal(marks[1]?.showsTime, true);
  });
});

describe('buildTimeMarks: Tageslinie', () => {
  it('setzt eine Linie vor den ersten Block mit Zeit und bei jedem Tageswechsel', () => {
    const marks: BlockTime[] = marksOf([
      textBlock(0, at(20, 9, 0)),
      textBlock(1, at(20, 9, 5)),
      textBlock(2, at(21, 9, 0)),
      textBlock(3, at(23, 9, 0)),
    ]);
    assert.deepEqual(
      marks.map((mark: BlockTime) => mark.separator),
      [
        { kind: 'day', label: 'Fr., 20.11.2026' },
        null,
        { kind: 'day', label: 'Sa., 21.11.2026' },
        { kind: 'day', label: 'Heute' },
      ],
    );
  });

  it('nennt gestern „Gestern“ und heute „Heute“', () => {
    assert.equal(formatDay(at(22, 23, 59), NOW), 'Gestern');
    assert.equal(formatDay(at(23, 0, 0), NOW), 'Heute');
  });

  it('ersetzt die Pausenlinie über Mitternacht durch die Tageslinie', () => {
    const marks: BlockTime[] = marksOf([textBlock(0, at(22, 23, 50)), textBlock(1, at(23, 1, 0))]);
    assert.equal(marks[1]?.separator?.kind, 'day');
  });
});

describe('buildTimeMarks: Pausenlinie', () => {
  it('setzt ab 30 Minuten eine gestrichelte Linie mit Dauer', () => {
    const start: number = at(23, 9, 0);
    const marks: BlockTime[] = marksOf([
      textBlock(0, start),
      textBlock(1, start + 29 * MINUTE),
      textBlock(2, start + 29 * MINUTE + 34 * MINUTE),
    ]);
    assert.equal(marks[1]?.separator, null);
    assert.deepEqual(marks[2]?.separator, { kind: 'gap', label: '34 Min. Pause' });
  });

  it('beginnt genau bei 30 Minuten', () => {
    const start: number = at(23, 9, 0);
    const marks: BlockTime[] = marksOf([textBlock(0, start), textBlock(1, start + 30 * MINUTE)]);
    assert.equal(marks[1]?.separator?.kind, 'gap');
  });

  it('nennt lange Pausen in Stunden und Minuten', () => {
    assert.equal(formatGap(129 * MINUTE), '2 Std. 9 Min. Pause');
    assert.equal(formatGap(59 * MINUTE), '59 Min. Pause');
  });

  it('setzt keine Linie neben einen Block ohne Zeit', () => {
    const start: number = at(23, 9, 0);
    const marks: BlockTime[] = marksOf([
      textBlock(0, start),
      textBlock(1, null),
      textBlock(2, start + 120 * MINUTE),
    ]);
    assert.equal(marks[2]?.separator, null);
  });

  it('misst bei einem Werkzeug-Block ab dem ersten Aufruf', () => {
    const start: number = at(23, 9, 0);
    const marks: BlockTime[] = marksOf([
      textBlock(0, start),
      toolsBlock([toolEntry(1, start + 40 * MINUTE), toolEntry(2, start + 41 * MINUTE)]),
      textBlock(3, start + 42 * MINUTE),
    ]);
    assert.equal(marks[1]?.separator?.label, '40 Min. Pause');
    assert.equal(marks[2]?.separator, null);
  });
});

describe('buildTimeMarks: Bestand ohne Zeit', () => {
  it('zeigt weder Zeit noch Linien und lässt Nachrichten des Nutzers unberührt', () => {
    const marks: BlockTime[] = marksOf([
      textBlock(0, null),
      toolsBlock([toolEntry(1, null)]),
      userBlock(2, at(23, 9, 0)),
    ]);
    assert.deepEqual(marks[0], { at: null, showsTime: false, separator: null });
    assert.deepEqual(marks[1], { at: null, showsTime: false, separator: null });
    assert.deepEqual(marks[2], {
      at: at(23, 9, 0),
      showsTime: true,
      separator: { kind: 'day', label: 'Heute' },
    });
  });

  it('liefert für einen leeren Verlauf nichts', () => {
    assert.deepEqual(marksOf([]), []);
  });
});
