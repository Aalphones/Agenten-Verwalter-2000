import { useCallback, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { useVirtualizer, type VirtualItem } from '@tanstack/react-virtual';
import {
  compareLabel,
  formatCount,
  FOREIGN_TEXT,
  statOf,
  statStamp,
} from '@/features/changes/changesScope';
import {
  buildRows,
  revealRange,
  rowKey,
  type DiffRow,
  type GapDirection,
  type GapRow,
} from '@/features/changes/diffRows';
import { highlightDiff } from '@/features/changes/highlightDiff';
import { useFileDiff } from '@/features/changes/useFileDiff';
import { useGapExpansion } from '@/features/changes/useGapExpansion';
import { CollectedNote } from '@/features/review/CollectedNote';
import { CommentBox } from '@/features/review/CommentBox';
import { fileName, lineLabel } from '@/features/review/reviewLabels';
import type { ChangeScope } from '@/lib/bindings/ChangeScope';
import type { ChangesReach } from '@/lib/bindings/ChangesReach';
import type { DiffLine } from '@/lib/bindings/DiffLine';
import type { DiffLineKind } from '@/lib/bindings/DiffLineKind';
import type { FileChange } from '@/lib/bindings/FileChange';
import type { LineStat } from '@/lib/bindings/LineStat';
import type { RepositoryChanges } from '@/lib/bindings/RepositoryChanges';
import { languageOf, plainLine, type SyntaxLine, type SyntaxSegment } from '@/lib/syntax';
import {
  lineIdOf,
  NO_COMMENTS,
  useReviewStore,
  type CollectedComment,
  type OpenCommentBox,
} from '@/stores/review';
import './DiffView.css';

const LINE_HEIGHT = 20;
// Höhen aus DiffView.css: Pfeilknopf 26 px, Linien je 1 px; measureElement misst ohnehin nach.
const GAP_HEIGHT = 28;
const MIDDLE_GAP_HEIGHT = 54;
const OVERSCAN = 20;
const BINARY_TEXT = 'Kein Textvergleich: Binärdatei oder größer als 8 MB.';
const EMPTY_TEXT = 'Keine Textänderungen.';
const TRUNCATED_TEXT = 'Gekürzt: nur die ersten 20.000 Zeilen werden angezeigt.';

interface DiffViewProps {
  sessionId: string;
  reach: ChangesReach;
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
  segments: SyntaxLine;
}

/** Eine kommentierbare Zeile: nie Abschnittskopf oder Kürzungs-Meldung. */
interface CommentTarget {
  lineId: string;
  kind: DiffLineKind;
  /** Neue Nummer; bei einer gelöschten Zeile die alte. */
  line: number;
  code: string;
  label: string;
}

const SIGN: Record<DiffLine['kind'], string> = {
  hunk: '',
  context: '',
  added: '+',
  deleted: '-',
};

/** Die Kürzungs-Meldung steht im Stil eines Abschnittskopfs. */
const TRUNCATED_LINE: RenderedLine = {
  kind: 'hunk',
  oldLine: '',
  newLine: '',
  sign: '',
  segments: plainLine(TRUNCATED_TEXT),
};

const GAP_ARROW: Record<Exclude<GapDirection, 'all'>, { title: string; where: string }> = {
  down: { title: 'Zeilen darunter anzeigen', where: 'darunter' },
  up: { title: 'Zeilen darüber anzeigen', where: 'darüber' },
};

export function DiffView({
  sessionId,
  reach,
  repository,
  file,
  scope,
  onClose,
}: DiffViewProps): ReactElement {
  const [revealLineId, setRevealLineId] = useState<string | null>(null);
  const stat: LineStat | null = statOf(file, scope);
  const { diff, error, isLoading } = useFileDiff(
    sessionId,
    reach,
    { key: repository.key, path: file.path },
    scope,
    statStamp(stat),
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const collected: readonly CollectedComment[] = useReviewStore(
    (state) => state.collected[sessionId] ?? NO_COMMENTS,
  );
  const box: OpenCommentBox | null = useReviewStore((state) => state.boxes[sessionId] ?? null);
  const openBox = useReviewStore((state) => state.openBox);
  const setBoxText = useReviewStore((state) => state.setBoxText);
  const closeBox = useReviewStore((state) => state.closeBox);
  const upsert = useReviewStore((state) => state.upsert);
  const remove = useReviewStore((state) => state.remove);

  // In der Übersicht des Vorhabens ist kein Chat zu sehen; ein Kommentar landete unsichtbar in der neuesten Session.
  const canComment: boolean = reach === 'session';
  const commentsByLine: Map<string, CollectedComment> = useMemo(
    () => new Map(collected.map((entry: CollectedComment) => [entry.lineId, entry])),
    [collected],
  );
  const lines: readonly DiffLine[] = useMemo(() => diff?.lines ?? [], [diff]);
  const language: string | null = useMemo(() => languageOf(file.path), [file.path]);
  const { expansions, busyGap, errorGap, expand, expandAll, collapseAll } = useGapExpansion(
    sessionId,
    reach,
    { key: repository.key, path: file.path },
    scope,
    diff,
    language,
  );
  const highlighted: SyntaxLine[] = useMemo(
    () => highlightDiff(lines, language),
    [lines, language],
  );
  const rows: readonly DiffRow[] = useMemo(
    () => (diff === null ? [] : buildRows(diff, expansions)),
    [diff, expansions],
  );
  const gaps: readonly GapRow[] = useMemo(
    () => rows.filter((row: DiffRow): row is GapRow => row.kind === 'gap'),
    [rows],
  );
  const hasGaps: boolean = gaps.length > 0 || expansions.size > 0;
  const isWholeFile: boolean = hasGaps && gaps.length === 0;
  const isBusy: boolean = busyGap !== null;
  const getItemKey = useCallback(
    (index: number): string => {
      const row: DiffRow | undefined = rows[index];
      return row === undefined ? `index-${String(index)}` : rowKey(row);
    },
    [rows],
  );

  // Die Warnung gilt dem React Compiler, den das Projekt nicht nutzt; die Bibliothek schreibt ADR 002 vor.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: (): HTMLDivElement | null => scrollRef.current,
    estimateSize: (index: number): number => estimatedHeight(rows[index]), // umgebrochene Zeilen misst measureElement nach
    getItemKey,
    overscan: OVERSCAN,
  });

  function openCommentBox(target: CommentTarget, text: string): void {
    setRevealLineId(target.lineId);
    openBox(sessionId, { lineId: target.lineId, text });
  }

  function submitComment(target: CommentTarget, text: string): void {
    upsert(sessionId, target.lineId, {
      target: { kind: 'diff' },
      repositoryKey: repository.key,
      repositoryName: repository.name,
      path: file.path,
      kind: target.kind,
      line: target.line,
      code: target.code,
      text: text.trim(),
    });
    closeBox(sessionId);
  }

  /** „+“ bzw. bei gesammeltem Kommentar die Sprechblase; bei offenem Feld an der Zeile keins von beiden. */
  function renderCommentButton(target: CommentTarget): ReactElement | null {
    if (box?.lineId === target.lineId) {
      return null;
    }
    const note: CollectedComment | undefined = commentsByLine.get(target.lineId);
    if (note !== undefined) {
      return (
        <button
          type="button"
          className="diff-view__comment diff-view__comment--collected"
          aria-label={`Kommentar zu ${target.label} bearbeiten`}
          title="Gesammelten Kommentar bearbeiten"
          onClick={(): void => {
            openCommentBox(target, note.comment.text);
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M2 2.5h8v5.5H5.5L3 10V8H2z" />
          </svg>
        </button>
      );
    }
    return (
      <button
        type="button"
        className="diff-view__comment"
        aria-label={`Kommentar zu ${target.label}`}
        title="Kommentar zu dieser Zeile – wird im Chat gesammelt"
        onClick={(): void => {
          openCommentBox(target, '');
        }}
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M5 1.5v7" />
          <path d="M1.5 5h7" />
        </svg>
      </button>
    );
  }

  /** Unter der Zeile: das offene Kommentarfeld oder der gesammelte Kommentar. */
  function renderCommentBelow(target: CommentTarget): ReactElement | null {
    const note: CollectedComment | undefined = commentsByLine.get(target.lineId);
    if (box?.lineId === target.lineId) {
      const text: string = box.text;
      return (
        <CommentBox
          fileLabel={fileName(file.path)}
          lineLabel={target.label}
          text={text}
          isEditing={note !== undefined}
          shouldReveal={revealLineId === target.lineId}
          onRevealed={(): void => {
            setRevealLineId(null);
          }}
          onChange={(value: string): void => {
            setBoxText(sessionId, value);
          }}
          onSubmit={(): void => {
            submitComment(target, text);
          }}
          onCancel={(): void => {
            closeBox(sessionId);
          }}
        />
      );
    }
    if (note === undefined) {
      return null;
    }
    return (
      <CollectedNote
        text={note.comment.text}
        onEdit={(): void => {
          openCommentBox(target, note.comment.text);
        }}
        onRemove={(): void => {
          remove(sessionId, note.id);
        }}
      />
    );
  }

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
        style={{ height: `${String(virtualizer.getTotalSize())}px` }}
      >
        {virtualizer.getVirtualItems().map((item: VirtualItem) => {
          const row: DiffRow | undefined = rows[item.index];
          // Die Zeile wächst mit Kommentarfeld oder Karte; measureElement misst den ganzen Block nach.
          return (
            <div
              key={item.key}
              ref={virtualizer.measureElement}
              data-index={item.index}
              className="diff-view__row"
              style={{ transform: `translateY(${String(item.start)}px)` }}
            >
              {row !== undefined && renderRow(row)}
            </div>
          );
        })}
      </div>
    );
  }

  function renderRow(row: DiffRow): ReactElement | null {
    switch (row.kind) {
      case 'line': {
        const line: DiffLine | undefined = lines[row.index];
        if (line === undefined) {
          return null;
        }
        const number: number | null = line.kind === 'deleted' ? line.oldLine : line.newLine;
        return renderCodeLine(
          renderLine(line, highlighted[row.index]),
          number === null ? null : commentTargetOf(line.kind, number, line.text),
        );
      }
      case 'revealed':
        return renderCodeLine(
          {
            kind: 'context',
            oldLine: String(row.oldLine),
            newLine: String(row.line),
            sign: '',
            segments: row.segments,
          },
          commentTargetOf('context', row.line, row.text),
        );
      case 'gap':
        return renderGap(row);
      case 'truncated':
        return renderCodeLine(TRUNCATED_LINE, null);
    }
  }

  function renderCodeLine(rendered: RenderedLine, target: CommentTarget | null): ReactElement {
    return (
      <>
        <div className={`diff-view__line diff-view__line--${rendered.kind}`}>
          {target !== null && renderCommentButton(target)}
          <span className="diff-view__old">{rendered.oldLine}</span>
          <span className="diff-view__new">{rendered.newLine}</span>
          <span className="diff-view__sign">{rendered.sign}</span>
          <span className="diff-view__text">
            {rendered.segments.map((segment: SyntaxSegment, index: number) =>
              segment.className === null ? (
                segment.text
              ) : (
                <span key={index} className={segment.className}>
                  {segment.text}
                </span>
              ),
            )}
          </span>
        </div>
        {target !== null && renderCommentBelow(target)}
      </>
    );
  }

  /** Balken einer Lücke: oben nur Pfeil nach oben, unten nur Pfeil nach unten, dazwischen beide. */
  function renderGap(gap: GapRow): ReactElement {
    const hidden: number = gap.to - gap.from + 1;
    const gapError: string | null =
      errorGap !== null && (errorGap.gap === 'all' || errorGap.gap === gap.id)
        ? errorGap.text
        : null;
    return (
      <div className="diff-view__gap">
        <div className="diff-view__gap-arrows">
          {gap.position !== 'top' && renderGapArrow(gap, 'down')}
          {gap.position !== 'bottom' && renderGapArrow(gap, 'up')}
        </div>
        <button
          type="button"
          className="diff-view__gap-label"
          disabled={isBusy}
          onClick={(): void => {
            expand(gap, 'all');
          }}
        >
          {hiddenLinesLabel(hidden)}
        </button>
        {gapError !== null && <span className="diff-view__gap-error">{gapError}</span>}
      </div>
    );
  }

  function renderGapArrow(gap: GapRow, direction: Exclude<GapDirection, 'all'>): ReactElement {
    const range: { from: number; to: number } = revealRange(gap, direction);
    const count: number = range.to - range.from + 1;
    const arrow: { title: string; where: string } = GAP_ARROW[direction];
    return (
      <button
        type="button"
        className="diff-view__gap-button"
        title={arrow.title}
        aria-label={`${formatCount(count)} ${count === 1 ? 'Zeile' : 'Zeilen'} ${arrow.where} anzeigen`}
        disabled={isBusy}
        onClick={(): void => {
          expand(gap, direction);
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {direction === 'down' ? (
            <path d="M7 3v8M3.5 7.5L7 11l3.5-3.5M3 2h8" />
          ) : (
            <path d="M7 11V3M3.5 6.5L7 3l3.5 3.5M3 12h8" />
          )}
        </svg>
      </button>
    );
  }

  /** Kommentierbar nur in der Session; eingeblendete Zeilen teilen die Kennung mit derselben Zeile aus dem Diff. */
  function commentTargetOf(kind: DiffLineKind, line: number, code: string): CommentTarget | null {
    if (!canComment) {
      return null;
    }
    return {
      lineId: lineIdOf(scope, repository.key, file.path, kind, line),
      kind,
      line,
      code,
      label: lineLabel(kind, line),
    };
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
        {hasGaps && (
          <button
            type="button"
            className="diff-view__whole"
            aria-pressed={isWholeFile}
            title={
              isWholeFile
                ? 'Eingeblendete Zeilen wieder ausblenden'
                : 'Alle unveränderten Zeilen einblenden'
            }
            disabled={isBusy}
            onClick={(): void => {
              if (isWholeFile) {
                collapseAll();
              } else {
                expandAll(gaps);
              }
            }}
          >
            {isWholeFile ? 'Nur Änderungen' : 'Ganze Datei'}
          </button>
        )}
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
      {stat !== null && stat.foreign && <p className="diff-view__foreign">{FOREIGN_TEXT[reach]}</p>}
      <div ref={scrollRef} className="diff-view__body">
        {renderBody()}
      </div>
    </div>
  );
}

function renderLine(line: DiffLine, segments: SyntaxLine | undefined): RenderedLine {
  return {
    kind: line.kind,
    oldLine: line.oldLine === null ? '' : String(line.oldLine),
    newLine: line.newLine === null ? '' : String(line.newLine),
    sign: SIGN[line.kind],
    segments: segments ?? plainLine(line.text),
  };
}

function estimatedHeight(row: DiffRow | undefined): number {
  if (row?.kind !== 'gap') {
    return LINE_HEIGHT;
  }
  return row.position === 'middle' ? MIDDLE_GAP_HEIGHT : GAP_HEIGHT;
}

function hiddenLinesLabel(count: number): string {
  return `${formatCount(count)} unveränderte ${count === 1 ? 'Zeile' : 'Zeilen'} anzeigen`;
}
