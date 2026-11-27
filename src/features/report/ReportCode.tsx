import { Fragment, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { ReportIcon } from '@/features/report/ReportIcon';
import { layoutNotes, type NoteBox, type NoteLayout } from '@/features/report/layoutNotes';
import {
  FILES_BUTTON_LABEL,
  MOVED_HINT,
  MOVED_TITLE,
  REMOVED_FOLD_MIN,
  UNCOVERED_TITLE,
  noteKindLabel,
} from '@/features/report/reportTexts';
import type { ReportCode as ReportCodeData } from '@/lib/bindings/ReportCode';
import type { ReportNote } from '@/lib/bindings/ReportNote';
import type { ReportRow } from '@/lib/bindings/ReportRow';
import { highlightLines, languageOf, type SyntaxLine } from '@/lib/syntax';
import './ReportCode.css';

/** Abstand zwischen zwei Randnotizen, in px. */
const NOTE_GAP = 6;
const SIGN: Record<ReportRow['kind'], string> = { add: '+', context: ' ', removed: '−' };

interface ReportCodeBlockProps {
  code: ReportCodeData;
  /** `true`: Notizen im Rand neben dem Code, sonst als Zeile unter dem Ende ihres Bereichs. */
  hasMargin: boolean;
  onOpenFile: (repositoryKey: string, path: string, line: number | null) => void;
}

interface PlacedNote {
  note: ReportNote;
  /** Erste und letzte Zeile des Bereichs, die der Block wirklich zeigt. */
  startLine: number;
  endLine: number;
}

/** Die Notizen, deren Zeilen der Block zeigt; die übrigen (`moved` oder außerhalb aller Hunks) stehen darunter. */
function placeNotes(code: ReportCodeData): { placed: PlacedNote[]; loose: ReportNote[] } {
  const shown: number[] = code.rows
    .map((row: ReportRow) => row.new)
    .filter((line: number | null): line is number => line !== null);
  const placed: PlacedNote[] = [];
  const loose: ReportNote[] = [];
  for (const note of code.notes) {
    const inside: number[] = shown.filter((line: number) => line >= note.from && line <= note.to);
    const startLine: number | undefined = inside[0];
    const endLine: number | undefined = inside[inside.length - 1];
    if (note.moved || startLine === undefined || endLine === undefined) {
      loose.push(note);
      continue;
    }
    placed.push({ note, startLine, endLine });
  }
  placed.sort((first: PlacedNote, second: PlacedNote) => first.startLine - second.startLine);
  return { placed, loose };
}

/** Länge des Laufs entfernter Zeilen, der an Zeile `index` beginnt; sonst 0. */
function removedRunAt(rows: readonly ReportRow[], index: number): number {
  if (rows[index]?.kind !== 'removed' || rows[index - 1]?.kind === 'removed') {
    return 0;
  }
  let end: number = index;
  while (rows[end]?.kind === 'removed') {
    end += 1;
  }
  return end - index;
}

function noteTone(note: ReportNote): string {
  return `report-code__tone--${note.kind}`;
}

function noteLabel(note: ReportNote): string {
  if (note.kind !== 'finding') {
    return noteKindLabel(note.kind);
  }
  if (note.open === true) {
    return `${note.by} · offen`;
  }
  if (note.open === false) {
    return `${note.by} · behoben`;
  }
  return note.by;
}

interface NoteViewProps {
  note: ReportNote;
  isHot: boolean;
  onHot: (label: string | null) => void;
}

function NoteView({ note, isHot, onHot }: NoteViewProps): ReactElement {
  const label: string = noteLabel(note);
  return (
    <div
      className={`report-code__note ${noteTone(note)}${isHot ? ' report-code__note--hot' : ''}`}
      data-note={note.label}
      onMouseEnter={(): void => {
        onHot(note.label);
      }}
      onMouseLeave={(): void => {
        onHot(null);
      }}
    >
      <span className={`report-code__mark ${noteTone(note)}`}>{note.label}</span>
      <span className="report-code__note-text">
        {label !== '' && <b className="report-code__note-who">{label}</b>}
        {note.text}
      </span>
    </div>
  );
}

export function ReportCodeBlock({
  code,
  hasMargin,
  onOpenFile,
}: ReportCodeBlockProps): ReactElement {
  const [hotLabel, setHotLabel] = useState<string | null>(null);
  const [openRuns, setOpenRuns] = useState<readonly number[]>([]);
  const [layout, setLayout] = useState<NoteLayout | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const asideRef = useRef<HTMLElement>(null);

  const lines: SyntaxLine[] = useMemo(
    () =>
      highlightLines(code.rows.map((row: ReportRow) => row.text).join('\n'), languageOf(code.path)),
    [code.rows, code.path],
  );
  const { placed, loose } = useMemo(() => placeNotes(code), [code]);
  const uncovered: ReadonlySet<number> = useMemo(() => new Set(code.uncovered), [code.uncovered]);

  // Die Höhen messen erst die fertigen Zeilen und Notizen; die Spalte setzt jede Notiz auf ihre Zeile.
  useLayoutEffect(() => {
    const table: HTMLTableElement | null = tableRef.current;
    const aside: HTMLElement | null = asideRef.current;
    if (!hasMargin || table === null || aside === null) {
      setLayout(null);
      return undefined;
    }
    function measure(): void {
      if (table === null || aside === null) {
        return;
      }
      const boxes: NoteBox[] = placed.map((entry: PlacedNote) => {
        const row: HTMLElement | null = table.querySelector<HTMLElement>(
          `tr[data-line="${String(entry.startLine)}"]`,
        );
        const noteElement: HTMLElement | null = aside.querySelector<HTMLElement>(
          `[data-note="${entry.note.label}"]`,
        );
        return { anchorTop: row?.offsetTop ?? 0, height: noteElement?.offsetHeight ?? 0 };
      });
      setLayout(layoutNotes(boxes, NOTE_GAP));
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(aside);
    return (): void => {
      observer.disconnect();
    };
  }, [hasMargin, placed, openRuns]);

  function toggleRun(index: number): void {
    setOpenRuns((current: readonly number[]) =>
      current.includes(index)
        ? current.filter((candidate: number) => candidate !== index)
        : [...current, index],
    );
  }

  function firstLine(): number | null {
    const first: PlacedNote | undefined = placed[0];
    if (first !== undefined) {
      return first.startLine;
    }
    return code.rows.find((row: ReportRow) => row.new !== null)?.new ?? null;
  }

  const fileName: string = code.path.slice(code.path.lastIndexOf('/') + 1);
  const directory: string = code.path.slice(0, code.path.length - fileName.length);
  const notesStartingAt = (line: number): PlacedNote[] =>
    placed.filter((entry: PlacedNote) => entry.startLine === line);
  const notesEndingAt = (line: number): PlacedNote[] =>
    placed.filter((entry: PlacedNote) => entry.endLine === line);
  const hotEntries: PlacedNote | undefined = placed.find(
    (entry: PlacedNote) => entry.note.label === hotLabel,
  );

  function renderRow(row: ReportRow, index: number): ReactElement | null {
    const run: number = removedRunAt(code.rows, index);
    const runKey: number = index;
    const isFolded: boolean = hideRemoved(index);
    const source: SyntaxLine = lines[index] ?? [];
    const lineNumber: number | null = row.kind === 'removed' ? row.old : row.new;
    const isHot: boolean =
      hotEntries !== undefined &&
      row.new !== null &&
      row.new >= hotEntries.note.from &&
      row.new <= hotEntries.note.to;
    const covering: PlacedNote[] = placed.filter(
      (entry: PlacedNote) =>
        row.new !== null && row.new >= entry.startLine && row.new <= entry.endLine,
    );
    const isMissed: boolean = row.kind === 'add' && row.new !== null && uncovered.has(row.new);
    const classes: string[] = [`report-code__row`, `report-code__row--${row.kind}`];
    if (covering.length > 0) {
      classes.push('report-code__row--noted');
    }
    if (isHot) {
      classes.push('report-code__row--hot');
    }
    if (isMissed) {
      classes.push('report-code__row--uncovered');
    }
    const marks: PlacedNote[] = row.new === null ? [] : notesStartingAt(row.new);
    const rowElement: ReactElement | null = isFolded ? null : (
      <tr
        key={`row-${String(index)}`}
        className={classes.join(' ')}
        data-line={row.new ?? undefined}
        title={isMissed ? UNCOVERED_TITLE : undefined}
      >
        <td className="report-code__num">{lineNumber}</td>
        <td className="report-code__marks">
          {marks.map((entry: PlacedNote) => (
            <span key={entry.note.label} className={`report-code__mark ${noteTone(entry.note)}`}>
              {entry.note.label}
            </span>
          ))}
        </td>
        <td className="report-code__sign">{SIGN[row.kind]}</td>
        <td className="report-code__src">
          {source.length === 0 ? ' ' : source.map(renderSegment)}
        </td>
      </tr>
    );
    const foldRow: ReactElement | null =
      run > REMOVED_FOLD_MIN ? (
        <tr key={`fold-${String(runKey)}`} className="report-code__fold">
          <td colSpan={4}>
            <button
              type="button"
              className="report-code__fold-button"
              aria-expanded={openRuns.includes(runKey)}
              onClick={(): void => {
                toggleRun(runKey);
              }}
            >
              {openRuns.includes(runKey)
                ? `${String(run)} entfernte Zeilen · verbergen`
                : `${String(run)} entfernte Zeilen · zeigen`}
            </button>
          </td>
        </tr>
      ) : null;
    const inlineRows: ReactElement[] = [];
    if (!hasMargin && row.new !== null) {
      for (const entry of notesEndingAt(row.new)) {
        inlineRows.push(
          <tr key={`inline-${entry.note.label}`} className="report-code__inline">
            <td colSpan={4}>
              <NoteView
                note={entry.note}
                isHot={hotLabel === entry.note.label}
                onHot={setHotLabel}
              />
            </td>
          </tr>,
        );
      }
    }
    return (
      <Fragment key={`group-${String(index)}`}>
        {foldRow}
        {rowElement}
        {inlineRows}
      </Fragment>
    );
  }

  function hideRemoved(index: number): boolean {
    // Ein langer Lauf entfernter Zeilen bleibt zu, bis sein Knopf ihn aufmacht.
    let start: number = index;
    while (code.rows[start - 1]?.kind === 'removed') {
      start -= 1;
    }
    if (code.rows[index]?.kind !== 'removed') {
      return false;
    }
    return removedRunAt(code.rows, start) > REMOVED_FOLD_MIN && !openRuns.includes(start);
  }

  return (
    <section className="report-code">
      <header className="report-code__head">
        <ReportIcon name="file" />
        <span className="report-code__path">
          {directory}
          <b>{fileName}</b>
        </span>
        <span className="report-code__added">+{code.added}</span>
        {code.removed > 0 && <span className="report-code__removed">−{code.removed}</span>}
        <span className="report-code__spacer" />
        <button
          type="button"
          className="report-code__button"
          onClick={(): void => {
            onOpenFile(code.repositoryKey, code.path, firstLine());
          }}
        >
          <ReportIcon name="ext" />
          {FILES_BUTTON_LABEL}
        </button>
      </header>
      <div className="report-code__body">
        <div
          className={`report-code__grid${hasMargin && placed.length > 0 ? ' report-code__grid--margin' : ''}`}
        >
          <div className="report-code__scroll">
            <table ref={tableRef} className="report-code__lines">
              <tbody>{code.rows.map(renderRow)}</tbody>
            </table>
          </div>
          {hasMargin && placed.length > 0 && (
            <aside
              ref={asideRef}
              className="report-code__aside"
              style={layout === null ? undefined : { minHeight: layout.height }}
            >
              {placed.map((entry: PlacedNote, position: number) => (
                <div
                  key={entry.note.label}
                  className="report-code__slot"
                  style={{ top: layout?.tops[position] ?? 0 }}
                >
                  <NoteView
                    note={entry.note}
                    isHot={hotLabel === entry.note.label}
                    onHot={setHotLabel}
                  />
                </div>
              ))}
            </aside>
          )}
        </div>
        {loose.length > 0 && (
          <div className="report-code__moved">
            <p className="report-code__moved-title">
              <ReportIcon name="hist" />
              <b>{MOVED_TITLE}</b>
              <span>{MOVED_HINT}</span>
            </p>
            {loose.map((note: ReportNote) => (
              <NoteView
                key={note.label}
                note={note}
                isHot={hotLabel === note.label}
                onHot={setHotLabel}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function renderSegment(segment: SyntaxLine[number], index: number): ReactElement {
  if (segment.className === null) {
    return <span key={index}>{segment.text}</span>;
  }
  return (
    <span key={index} className={segment.className}>
      {segment.text}
    </span>
  );
}
