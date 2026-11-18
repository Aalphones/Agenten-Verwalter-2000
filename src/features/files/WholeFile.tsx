import { useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { ReactElement, Ref } from 'react';
import { useVirtualizer, type VirtualItem } from '@tanstack/react-virtual';
import {
  nextStopIndex,
  type StopHandle,
  type StopPosition,
} from '@/features/changes/stopNavigation';
import type { ChangedLines } from '@/features/files/changedLines';
import { highlightLines, languageOf, type SyntaxLine, type SyntaxSegment } from '@/lib/syntax';
import './WholeFile.css';

const LINE_HEIGHT = 20;
const OVERSCAN = 30;
const ADDED_TITLE = 'In diesem Vorhaben geändert';
const REMOVED_TITLE = 'Hier wurden Zeilen entfernt';

interface WholeFileProps {
  /** Der Inhalt; eine abschließende Zeilenschaltung öffnet keine leere Zeile. */
  text: string;
  path: string;
  /** Markierungen der geänderten Zeilen; `null` ohne (unveränderte oder neue Datei). */
  marks: ChangedLines | null;
  /** Angesprungene Zeile, hinterlegt und fett nummeriert. */
  highlightLine: number | null;
  /** Springt beim Öffnen zu dieser Zeile. */
  scrollToLine: number | null;
  handle?: Ref<StopHandle>;
  onPosition?: (stop: StopPosition) => void;
}

function splitText(text: string): string {
  return text.endsWith('\n') ? text.slice(0, -1) : text;
}

/** Die ganze Datei mit Zeilennummern und Syntaxfarben; nur sichtbare Zeilen stehen im DOM. */
export function WholeFile({
  text,
  path,
  marks,
  highlightLine,
  scrollToLine,
  handle,
  onPosition,
}: WholeFileProps): ReactElement {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [stopIndex, setStopIndex] = useState<number>(-1);
  const lines: SyntaxLine[] = useMemo(
    () => highlightLines(splitText(text), languageOf(path)),
    [text, path],
  );
  const starts: readonly number[] = useMemo(() => marks?.starts ?? [], [marks]);
  const numberWidth: number = String(lines.length).length;

  // Die Warnung gilt dem React Compiler, den das Projekt nicht nutzt; die Bibliothek schreibt ADR 002 vor.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: lines.length,
    getScrollElement: (): HTMLDivElement | null => scrollRef.current,
    estimateSize: (): number => LINE_HEIGHT,
    overscan: OVERSCAN,
  });

  useImperativeHandle(
    handle,
    (): StopHandle => ({
      step: (direction: 1 | -1): void => {
        const next: number = nextStopIndex(stopIndex, direction, starts.length);
        const line: number | undefined = starts[next];
        if (line === undefined) {
          return;
        }
        setStopIndex(next);
        virtualizer.scrollToIndex(line - 1, { align: 'center' });
      },
      topLine: (): number | null => {
        const top: number = scrollRef.current?.scrollTop ?? 0;
        return Math.floor(top / LINE_HEIGHT) + 1;
      },
    }),
    [stopIndex, starts, virtualizer],
  );
  useEffect(() => {
    onPosition?.({ position: stopIndex + 1, count: starts.length });
  }, [onPosition, stopIndex, starts.length]);
  useEffect(() => {
    if (scrollToLine !== null) {
      virtualizer.scrollToIndex(scrollToLine - 1, { align: 'center' });
    }
    // Nur beim Öffnen; ein späteres Neuzeichnen soll die Ansicht nicht zurückholen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function renderLine(index: number): ReactElement {
    const number: number = index + 1;
    const isAdded: boolean = marks?.added.has(number) ?? false;
    const isRemoved: boolean = marks?.removedBefore.has(number) ?? false;
    const isTarget: boolean = highlightLine === number;
    let markTitle: string | undefined;
    if (isAdded) {
      markTitle = isRemoved ? `${ADDED_TITLE}; davor ${REMOVED_TITLE.toLowerCase()}` : ADDED_TITLE;
    } else if (isRemoved) {
      markTitle = REMOVED_TITLE;
    }
    const segments: SyntaxLine = lines[index] ?? [];
    return (
      <div className={`whole-file__line${isTarget ? ' whole-file__line--target' : ''}`}>
        <span
          className="whole-file__number"
          style={{ minWidth: `${String(numberWidth)}ch` }}
          data-target={isTarget ? 'true' : undefined}
        >
          {number}
        </span>
        <span
          className={`whole-file__mark${isAdded ? ' whole-file__mark--added' : ''}${isRemoved ? ' whole-file__mark--removed' : ''}`}
          title={markTitle}
        />
        <span className="whole-file__text">
          {segments.map((segment: SyntaxSegment, segmentIndex: number) =>
            segment.className === null ? (
              segment.text
            ) : (
              <span key={segmentIndex} className={segment.className}>
                {segment.text}
              </span>
            ),
          )}
        </span>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="whole-file">
      <div
        className="whole-file__canvas"
        style={{ height: `${String(virtualizer.getTotalSize())}px` }}
      >
        {virtualizer.getVirtualItems().map((item: VirtualItem) => (
          <div
            key={item.key}
            className="whole-file__row"
            style={{ transform: `translateY(${String(item.start)}px)` }}
          >
            {renderLine(item.index)}
          </div>
        ))}
      </div>
    </div>
  );
}
