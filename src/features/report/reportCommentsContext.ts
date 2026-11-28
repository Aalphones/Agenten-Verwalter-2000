import { createContext, useContext } from 'react';
import type { ReportCode } from '@/lib/bindings/ReportCode';
import type { ReportRow } from '@/lib/bindings/ReportRow';
import type { ReviewComment } from '@/lib/bindings/ReviewComment';
import { reportLineId, lineIdOf } from '@/stores/review';
import type { CollectedComment } from '@/stores/review';

/** Längste Beschriftung eines Kommentarziels; der Core lehnt längere ab. */
export const MAX_LABEL_CHARS = 80;
const PERCENT = 100;
const MIN_AREA_PERCENT = 1;
const AREA_SEPARATOR = '|';
const NO_COMMENTS: readonly CollectedComment[] = [];
const NO_AREAS: readonly PictureArea[] = [];

/** Eine Stelle auf dem Bildschirm, an der das Kommentarfeld hängt: ein Knopf oder ein Bereich auf einem Bild. */
export interface Anchor {
  readonly isConnected: boolean;
  getBoundingClientRect: () => DOMRect;
}

/** Rechteck auf einem Bild in Prozent der Bildgröße. */
export interface AreaRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Ein Bildbereich, der einen Kommentar trägt (oder gerade einen bekommt). */
export interface PictureArea {
  key: string;
  rect: AreaRect;
  text: string;
  isPending: boolean;
}

/** Ein Stopp, ein Schaubild oder ein Bildschirm als Ziel eines Kommentars. */
export interface EntryTarget {
  /** Nummer des Eintrags; `null` bei einem Stopp ohne Warum-Text. */
  entry: number | null;
  /** Stopp-Titel, Bildunterschrift bzw. Bildschirm-Name. */
  label: string;
  /** Unterscheidet Ziele mit gleichem Titel ohne Eintrag, etwa zwei Stopps ohne Warum-Text. */
  slot?: string;
}

/** Ein Bild des Berichts als Ziel eines Bereichs-Kommentars. */
export interface ImageTarget {
  entry: number;
  /** Unterschrift bzw. Bildschirm-Name samt Ansicht. */
  label: string;
  /** Welches Bild des Eintrags; ohne `|`. */
  imageKey: string;
}

/** Was das Kommentarfeld braucht, um einen Kommentar zu bauen und zu beschriften. */
export interface ComposerRequest {
  lineId: string;
  /** „Kommentar zu <Ort>“ in der Kopfzeile des Felds. */
  where: string;
  initialText: string;
  build: (text: string) => ReviewComment;
  /** Beim Bildbereich: das Rechteck, das bis zum Schließen des Felds auf dem Bild stehen bleibt. */
  preview?: { imageKey: string; rect: AreaRect };
}

export interface ReportCommentsValue {
  implementationId: string;
  /** Aus, sobald die Abnahme gelaufen ist: dann gibt es weder Knöpfe noch neue Kommentare. */
  isEnabled: boolean;
  comments: readonly CollectedComment[];
  isComposerOpen: boolean;
  pendingPreview: { imageKey: string; rect: AreaRect } | null;
  open: (anchor: Anchor, request: ComposerRequest) => void;
  closeComposer: () => void;
  remove: (id: string) => void;
}

export const ReportCommentsContext = createContext<ReportCommentsValue | null>(null);
/** Schlüssel der Phase, deren Seite gerade gezeigt wird. */
export const ReportPhaseKeyContext = createContext<string | null>(null);

export function clipLabel(label: string): string {
  const characters: string[] = Array.from(label);
  if (characters.length <= MAX_LABEL_CHARS) {
    return label;
  }
  return `${characters.slice(0, MAX_LABEL_CHARS - 1).join('')}…`;
}

function emptyTarget(
  implementationId: string,
  phaseKey: string,
  entry: number | null,
  label: string,
): ReviewComment['target'] {
  return { kind: 'report', implementationId, phaseKey, entry, label: clipLabel(label) };
}

function reportComment(
  target: ReviewComment['target'],
  text: string,
  line?: { code: ReportCode; row: ReportRow },
): ReviewComment {
  if (line === undefined) {
    return {
      target,
      repositoryKey: '',
      repositoryName: '',
      path: '',
      kind: 'context',
      line: 0,
      code: '',
      text,
    };
  }
  return {
    target,
    repositoryKey: line.code.repositoryKey,
    // Ein Repository außerhalb des Vorhabens heißt `extern:<Pfad>`; dem Agenten nützt der Pfad.
    repositoryName: line.code.repositoryKey.replace(/^extern:/, ''),
    path: line.code.path,
    kind: line.row.kind === 'add' ? 'added' : 'context',
    line: line.row.new ?? 0,
    code: line.row.text,
    text,
  };
}

function roundedPercent(value: number): number {
  return Math.round(value);
}

/** „[Bereich x %, y %, b %, h %]“ — der Bereich als Prozentangabe vor dem Kommentartext. */
export function areaPrefix(rect: AreaRect): string {
  return `[Bereich ${String(roundedPercent(rect.x))} %, ${String(roundedPercent(rect.y))} %, ${String(roundedPercent(rect.w))} %, ${String(roundedPercent(rect.h))} %]`;
}

function areaKey(rect: AreaRect): string {
  return [rect.x, rect.y, rect.w, rect.h]
    .map((value: number) => String(roundedPercent(value)))
    .join(',');
}

function parseArea(lineId: string, imageKey: string): AreaRect | null {
  const parts: string[] = lineId.split(AREA_SEPARATOR);
  if (parts.length < 2 || parts[parts.length - 2] !== imageKey) {
    return null;
  }
  const numbers: number[] = (parts[parts.length - 1] ?? '').split(',').map(Number);
  const [x, y, w, h] = numbers;
  if (x === undefined || y === undefined || w === undefined || h === undefined) {
    return null;
  }
  if (numbers.some((value: number) => Number.isNaN(value))) {
    return null;
  }
  return { x, y, w, h };
}

export interface ReportCommenting {
  isEnabled: boolean;
  isComposerOpen: boolean;
  closeComposer: () => void;
  remove: (id: string) => void;
  /** Kommentar an eine Code-Zeile (neue oder unveränderte). */
  commentOnLine: (anchor: Anchor, code: ReportCode, row: ReportRow) => void;
  commentsOfLine: (code: ReportCode, row: ReportRow) => readonly CollectedComment[];
  /** Kommentar an einen Stopp, ein Schaubild oder einen Bildschirm. */
  commentOnEntry: (anchor: Anchor, target: EntryTarget) => void;
  commentsOfEntry: (target: EntryTarget) => readonly CollectedComment[];
  /** Kommentar an einen Bildbereich; `rect` in Prozent. */
  commentOnArea: (anchor: Anchor, target: ImageTarget, rect: AreaRect) => void;
  commentsOfImage: (target: ImageTarget) => readonly CollectedComment[];
  areasOfImage: (target: ImageTarget) => readonly PictureArea[];
}

const DISABLED: ReportCommenting = {
  isEnabled: false,
  isComposerOpen: false,
  closeComposer: (): void => undefined,
  remove: (): void => undefined,
  commentOnLine: (): void => undefined,
  commentsOfLine: (): readonly CollectedComment[] => NO_COMMENTS,
  commentOnEntry: (): void => undefined,
  commentsOfEntry: (): readonly CollectedComment[] => NO_COMMENTS,
  commentOnArea: (): void => undefined,
  commentsOfImage: (): readonly CollectedComment[] => NO_COMMENTS,
  areasOfImage: (): readonly PictureArea[] => NO_AREAS,
};

/** Die Kommentar-Möglichkeiten der Seite: Kommentare lesen und neue anlegen; ohne Anbieter ist alles aus. */
export function useReportCommenting(): ReportCommenting {
  const value: ReportCommentsValue | null = useContext(ReportCommentsContext);
  const phaseKey: string | null = useContext(ReportPhaseKeyContext);
  if (value === null || phaseKey === null) {
    return DISABLED;
  }
  const { implementationId, comments } = value;

  function existingText(lineId: string): string {
    return comments.find((entry: CollectedComment) => entry.lineId === lineId)?.comment.text ?? '';
  }

  function lineIdOfRow(code: ReportCode, row: ReportRow): string {
    return `report-code|${phaseKey ?? ''}|${lineIdOf('all', code.repositoryKey, code.path, 'added', row.new ?? 0)}`;
  }

  function commentsWith(lineId: string): readonly CollectedComment[] {
    return comments.filter((entry: CollectedComment) => entry.lineId === lineId);
  }

  function imageLineIdOf(target: ImageTarget, rect: AreaRect): string {
    return reportLineId(
      phaseKey ?? '',
      target.entry,
      target.label,
      `${target.imageKey}${AREA_SEPARATOR}${areaKey(rect)}`,
    );
  }

  return {
    isEnabled: value.isEnabled,
    isComposerOpen: value.isComposerOpen,
    closeComposer: value.closeComposer,
    remove: value.remove,
    commentOnLine: (anchor: Anchor, code: ReportCode, row: ReportRow): void => {
      const lineId: string = lineIdOfRow(code, row);
      value.open(anchor, {
        lineId,
        where: `${code.path} · Zeile ${String(row.new ?? 0)}`,
        initialText: existingText(lineId),
        build: (text: string): ReviewComment =>
          reportComment({ kind: 'diff' }, text, { code, row }),
      });
    },
    commentsOfLine: (code: ReportCode, row: ReportRow): readonly CollectedComment[] =>
      commentsWith(lineIdOfRow(code, row)),
    commentOnEntry: (anchor: Anchor, target: EntryTarget): void => {
      const lineId: string = reportLineId(phaseKey, target.entry, target.label, target.slot);
      value.open(anchor, {
        lineId,
        where: target.label,
        initialText: existingText(lineId),
        build: (text: string): ReviewComment =>
          reportComment(emptyTarget(implementationId, phaseKey, target.entry, target.label), text),
      });
    },
    commentsOfEntry: (target: EntryTarget): readonly CollectedComment[] =>
      commentsWith(reportLineId(phaseKey, target.entry, target.label, target.slot)),
    commentOnArea: (anchor: Anchor, target: ImageTarget, rect: AreaRect): void => {
      const lineId: string = imageLineIdOf(target, rect);
      value.open(anchor, {
        lineId,
        where: `${target.label} · Bereich`,
        initialText: '',
        preview: { imageKey: target.imageKey, rect },
        build: (text: string): ReviewComment =>
          reportComment(
            emptyTarget(implementationId, phaseKey, target.entry, target.label),
            `${areaPrefix(rect)} ${text}`,
          ),
      });
    },
    commentsOfImage: (target: ImageTarget): readonly CollectedComment[] =>
      comments.filter(
        (entry: CollectedComment) =>
          entry.lineId.startsWith(
            `${reportLineId(phaseKey, target.entry, target.label)}${AREA_SEPARATOR}`,
          ) && parseArea(entry.lineId, target.imageKey) !== null,
      ),
    areasOfImage: (target: ImageTarget): readonly PictureArea[] => {
      const areas: PictureArea[] = [];
      for (const entry of comments) {
        const rect: AreaRect | null = parseArea(entry.lineId, target.imageKey);
        if (
          rect === null ||
          !entry.lineId.startsWith(reportLineId(phaseKey, target.entry, target.label))
        ) {
          continue;
        }
        areas.push({ key: entry.id, rect, text: entry.comment.text, isPending: false });
      }
      const pending = value.pendingPreview;
      if (pending !== null && pending.imageKey === target.imageKey) {
        areas.push({ key: 'pending', rect: pending.rect, text: '', isPending: true });
      }
      return areas;
    },
  };
}

/** Die Stelle eines Bildbereichs auf dem Bildschirm; folgt dem Bild beim Scrollen. */
export function areaAnchor(frame: Element, rect: AreaRect): Anchor {
  return {
    get isConnected(): boolean {
      return frame.isConnected;
    },
    getBoundingClientRect: (): DOMRect => {
      const box: DOMRect = frame.getBoundingClientRect();
      const left: number = box.left + (box.width * rect.x) / PERCENT;
      const top: number = box.top + (box.height * rect.y) / PERCENT;
      const width: number = (box.width * rect.w) / PERCENT;
      const height: number = (box.height * rect.h) / PERCENT;
      return new DOMRect(left, top, width, height);
    },
  };
}

/** Schlüssel eines Bildes innerhalb eines Eintrags; er steht in der Kennung und darf kein `|` enthalten. */
export function imageKeyOf(name: string): string {
  return name.split(AREA_SEPARATOR).join('/');
}

/** Rechteck aus zwei Ecken in Bildpixeln als Prozent der Bildgröße; zu kleine Auswahl wird zu einem festen Kästchen. */
export function areaFromCorners(
  start: { x: number; y: number },
  end: { x: number; y: number },
  size: { width: number; height: number },
): AreaRect {
  const MIN_PIXELS = 12;
  const FALLBACK_WIDTH = 80;
  const FALLBACK_HEIGHT = 40;
  let left: number = Math.min(start.x, end.x);
  let top: number = Math.min(start.y, end.y);
  let width: number = Math.abs(end.x - start.x);
  let height: number = Math.abs(end.y - start.y);
  if (width < MIN_PIXELS || height < MIN_PIXELS) {
    left = Math.max(0, left - FALLBACK_WIDTH / 2);
    top = Math.max(0, top - FALLBACK_HEIGHT / 2);
    width = FALLBACK_WIDTH;
    height = FALLBACK_HEIGHT;
  }
  width = Math.min(width, size.width - left);
  height = Math.min(height, size.height - top);
  return {
    x: (left / size.width) * PERCENT,
    y: (top / size.height) * PERCENT,
    w: Math.max(MIN_AREA_PERCENT, (width / size.width) * PERCENT),
    h: Math.max(MIN_AREA_PERCENT, (height / size.height) * PERCENT),
  };
}
