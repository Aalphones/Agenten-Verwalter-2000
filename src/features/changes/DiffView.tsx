import { useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { useVirtualizer, type VirtualItem } from '@tanstack/react-virtual';
import {
  compareLabel,
  formatCount,
  FOREIGN_TEXT,
  statOf,
  statStamp,
} from '@/features/changes/changesScope';
import { highlightDiff } from '@/features/changes/highlightDiff';
import { useFileDiff } from '@/features/changes/useFileDiff';
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
  const highlighted: SyntaxLine[] = useMemo(
    () => highlightDiff(lines, language),
    [lines, language],
  );
  const isTruncated: boolean = diff?.truncated ?? false;
  const count: number = lines.length + (isTruncated ? 1 : 0);

  // Die Warnung gilt dem React Compiler, den das Projekt nicht nutzt; die Bibliothek schreibt ADR 002 vor.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count,
    getScrollElement: (): HTMLDivElement | null => scrollRef.current,
    estimateSize: (): number => LINE_HEIGHT, // umgebrochene Zeilen misst measureElement nach
    overscan: OVERSCAN,
  });

  function openCommentBox(target: CommentTarget, text: string): void {
    setRevealLineId(target.lineId);
    openBox(sessionId, { lineId: target.lineId, text });
  }

  function submitComment(target: CommentTarget, text: string): void {
    upsert(sessionId, target.lineId, {
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
          const line: DiffLine | undefined = lines[item.index];
          const rendered: RenderedLine = renderLine(line, highlighted[item.index]);
          const target: CommentTarget | null = canComment
            ? commentTargetOf(line, scope, repository.key, file.path)
            : null;
          // Die Zeile wächst mit Kommentarfeld oder Karte; measureElement misst den ganzen Block nach.
          return (
            <div
              key={item.key}
              ref={virtualizer.measureElement}
              data-index={item.index}
              className="diff-view__row"
              style={{ transform: `translateY(${String(item.start)}px)` }}
            >
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
      {stat !== null && stat.foreign && <p className="diff-view__foreign">{FOREIGN_TEXT[reach]}</p>}
      <div ref={scrollRef} className="diff-view__body">
        {renderBody()}
      </div>
    </div>
  );
}

function commentTargetOf(
  line: DiffLine | undefined,
  scope: ChangeScope,
  repositoryKey: string,
  path: string,
): CommentTarget | null {
  if (line === undefined || line.kind === 'hunk') {
    return null;
  }
  const number: number | null = line.kind === 'deleted' ? line.oldLine : line.newLine;
  if (number === null) {
    return null;
  }
  return {
    lineId: lineIdOf(scope, repositoryKey, path, line.kind, number),
    kind: line.kind,
    line: number,
    code: line.text,
    label: lineLabel(line.kind, number),
  };
}

/** Ohne Zeile (Index hinter der letzten) steht die Kürzungs-Meldung im Stil eines Abschnittskopfs. */
function renderLine(line: DiffLine | undefined, segments: SyntaxLine | undefined): RenderedLine {
  if (line === undefined) {
    return {
      kind: 'hunk',
      oldLine: '',
      newLine: '',
      sign: '',
      segments: plainLine(TRUNCATED_TEXT),
    };
  }
  return {
    kind: line.kind,
    oldLine: line.oldLine === null ? '' : String(line.oldLine),
    newLine: line.newLine === null ? '' : String(line.newLine),
    sign: SIGN[line.kind],
    segments: segments ?? plainLine(line.text),
  };
}
