import { useMemo, useRef } from 'react';
import type { ReactElement } from 'react';
import { useVirtualizer, type VirtualItem } from '@tanstack/react-virtual';
import { compareLabel, formatCount, statOf, statStamp } from '@/features/changes/changesScope';
import { useFileDiff } from '@/features/changes/useFileDiff';
import type { ChangeScope } from '@/lib/bindings/ChangeScope';
import type { DiffLine } from '@/lib/bindings/DiffLine';
import type { FileChange } from '@/lib/bindings/FileChange';
import type { LineStat } from '@/lib/bindings/LineStat';
import type { RepositoryChanges } from '@/lib/bindings/RepositoryChanges';
import './DiffView.css';

const LINE_HEIGHT = 20;
const OVERSCAN = 20;
const TAB_WIDTH = 4;
const GUTTER_WIDTH = 116; // zwei Nummernspalten (48 px) plus Vorzeichen (20 px)
const TEXT_PADDING_RIGHT = 16;
const BINARY_TEXT = 'Kein Textvergleich: Binärdatei oder größer als 8 MB.';
const EMPTY_TEXT = 'Keine Textänderungen.';
const TRUNCATED_TEXT = 'Gekürzt: nur die ersten 20.000 Zeilen werden angezeigt.';

interface DiffViewProps {
  sessionId: string;
  repository: RepositoryChanges;
  file: FileChange;
  scope: ChangeScope;
  onClose: () => void;
}

interface RenderedLine {
  kind: DiffLine['kind'];
  oldLine: string;
  newLine: string;
  sign: string;
  text: string;
}

const SIGN: Record<DiffLine['kind'], string> = {
  hunk: '',
  context: '',
  added: '+',
  deleted: '-',
};

export function DiffView({
  sessionId,
  repository,
  file,
  scope,
  onClose,
}: DiffViewProps): ReactElement {
  const stat: LineStat | null = statOf(file, scope);
  const { diff, error, isLoading } = useFileDiff(
    sessionId,
    { position: repository.position, path: file.path },
    scope,
    statStamp(stat),
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  const lines: readonly DiffLine[] = useMemo(() => diff?.lines ?? [], [diff]);
  const isTruncated: boolean = diff?.truncated ?? false;
  const count: number = lines.length + (isTruncated ? 1 : 0);

  const maxChars: number = useMemo(() => {
    let longest = 0;
    for (const line of lines) {
      longest = Math.max(longest, visibleLength(line.text));
    }
    return longest;
  }, [lines]);

  // Die Warnung gilt dem React Compiler, den das Projekt nicht nutzt; die Bibliothek schreibt ADR 002 vor.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count,
    getScrollElement: (): HTMLDivElement | null => scrollRef.current,
    estimateSize: (): number => LINE_HEIGHT,
    overscan: OVERSCAN,
  });

  function renderBody(): ReactElement {
    if (isLoading) {
      return <p className="diff-view__notice">Diff wird geladen …</p>;
    }
    if (error !== null) {
      return <p className="diff-view__notice diff-view__notice--error">{error}</p>;
    }
    if (diff === null) {
      return <p className="diff-view__notice">{EMPTY_TEXT}</p>;
    }
    if (diff.binary) {
      return <p className="diff-view__notice">{BINARY_TEXT}</p>;
    }
    if (diff.lines.length === 0) {
      return <p className="diff-view__notice">{EMPTY_TEXT}</p>;
    }
    return (
      <div
        className="diff-view__canvas"
        style={{
          height: `${String(virtualizer.getTotalSize())}px`,
          width: `max(100%, calc(${String(GUTTER_WIDTH)}px + ${String(maxChars)}ch + ${String(TEXT_PADDING_RIGHT)}px))`,
        }}
      >
        {virtualizer.getVirtualItems().map((item: VirtualItem) => {
          const rendered: RenderedLine = renderLine(lines[item.index]);
          return (
            <div
              key={item.key}
              className={`diff-view__line diff-view__line--${rendered.kind}`}
              style={{ transform: `translateY(${String(item.start)}px)` }}
            >
              <span className="diff-view__old">{rendered.oldLine}</span>
              <span className="diff-view__new">{rendered.newLine}</span>
              <span className="diff-view__sign">{rendered.sign}</span>
              <span className="diff-view__text">{rendered.text}</span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="diff-view">
      <div className="diff-view__header">
        <span className="diff-view__repository">{repository.name} /</span>
        <span className="diff-view__path">{file.path}</span>
        {stat !== null && stat.binary && <span className="diff-view__binary">binär</span>}
        {stat !== null && !stat.binary && (
          <>
            <span className="diff-view__added">+{formatCount(stat.added)}</span>
            <span className="diff-view__deleted">−{formatCount(stat.deleted)}</span>
          </>
        )}
        <span className="diff-view__spacer" />
        <span className="diff-view__compare" title="Links der ältere, rechts der neuere Stand">
          {compareLabel(scope, repository.baseRef, repository.branch)}
        </span>
        <button
          type="button"
          className="diff-view__close"
          aria-label="Diff schließen"
          onClick={onClose}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" />
          </svg>
        </button>
      </div>
      <div ref={scrollRef} className="diff-view__body">
        {renderBody()}
      </div>
    </div>
  );
}

/** Ohne Zeile (Index hinter der letzten) steht die Kürzungs-Meldung im Stil eines Abschnittskopfs. */
function renderLine(line: DiffLine | undefined): RenderedLine {
  if (line === undefined) {
    return { kind: 'hunk', oldLine: '', newLine: '', sign: '', text: TRUNCATED_TEXT };
  }
  return {
    kind: line.kind,
    oldLine: line.oldLine === null ? '' : String(line.oldLine),
    newLine: line.newLine === null ? '' : String(line.newLine),
    sign: SIGN[line.kind],
    text: line.text,
  };
}

/** Länge in Zeichen, Tabs zählen als vier. */
function visibleLength(text: string): number {
  let tabs = 0;
  for (const character of text) {
    if (character === '\t') {
      tabs += 1;
    }
  }
  return text.length + tabs * (TAB_WIDTH - 1);
}
