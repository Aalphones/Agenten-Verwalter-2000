import { useRef, useState } from 'react';
import type { CSSProperties, MouseEvent, PointerEvent, ReactElement } from 'react';
import { ReportCommentButton } from '@/features/report/ReportCommentButton';
import { ReportCommentCards } from '@/features/report/ReportCommentCards';
import { ReportIcon } from '@/features/report/ReportIcon';
import {
  areaAnchor,
  areaFromCorners,
  useReportCommenting,
  type AreaRect,
  type ImageTarget,
  type PictureArea,
  type ReportCommenting,
} from '@/features/report/reportCommentsContext';
import {
  AREA_COMMENT_LABEL,
  AREA_DRAW_HINT,
  AREA_DRAW_LABEL,
  IMAGE_MISSING_TEXT,
  ZOOM_LABEL,
} from '@/features/report/reportTexts';
import type { ReportImage } from '@/lib/bindings/ReportImage';
import type { ReportMark } from '@/lib/bindings/ReportMark';
import './ReportPicture.css';

interface ReportPictureProps {
  image: ReportImage;
  marks: readonly ReportMark[];
  alt: string;
  /** Schmales Foto (höchstens 600 px breit): wird nicht auf die ganze Breite gezogen. */
  isNarrow: boolean;
  hotMark: number | null;
  onHotMark: (mark: number | null) => void;
  /** Klick auf das Bild öffnet es groß; ohne diesen Rückruf ist das Bild kein Schalter. */
  onOpen?: () => void;
  /** Als Ziel für Bereichs-Kommentare; ohne Angabe lässt sich auf diesem Bild kein Bereich kommentieren. */
  areaTarget?: ImageTarget | undefined;
}

interface DragState {
  start: { x: number; y: number };
  end: { x: number; y: number };
}

const PERCENT = 100;
const NO_AREAS: readonly PictureArea[] = [];

function rectStyle(rect: AreaRect): CSSProperties {
  return {
    left: `${String(rect.x)}%`,
    top: `${String(rect.y)}%`,
    width: `${String(rect.w)}%`,
    height: `${String(rect.h)}%`,
  };
}

function dragStyle(drag: DragState): CSSProperties {
  return {
    left: `${String(Math.min(drag.start.x, drag.end.x))}px`,
    top: `${String(Math.min(drag.start.y, drag.end.y))}px`,
    width: `${String(Math.abs(drag.end.x - drag.start.x))}px`,
    height: `${String(Math.abs(drag.end.y - drag.start.y))}px`,
  };
}

function pointOf(event: PointerEvent<HTMLElement>): { x: number; y: number } {
  const box: DOMRect = event.currentTarget.getBoundingClientRect();
  return { x: event.clientX - box.left, y: event.clientY - box.top };
}

/** Die Marke als Rechteck in Prozent der Bildgröße; Pixelwerte des Agenten bleiben an ihrer Stelle, egal wie breit
 *  das Bild gezeigt wird. */
function markStyle(mark: ReportMark, image: ReportImage): CSSProperties {
  return {
    left: `${String((mark.x / image.width) * PERCENT)}%`,
    top: `${String((mark.y / image.height) * PERCENT)}%`,
    width: `${String((mark.w / image.width) * PERCENT)}%`,
    height: `${String((mark.h / image.height) * PERCENT)}%`,
  };
}

/** Ein Bild des Berichts mit seinen nummerierten Marken. */
export function ReportPicture({
  image,
  marks,
  alt,
  isNarrow,
  hotMark,
  onHotMark,
  onOpen,
  areaTarget,
}: ReportPictureProps): ReactElement {
  const [isBroken, setIsBroken] = useState<boolean>(false);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [drag, setDrag] = useState<DragState | null>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const commenting: ReportCommenting = useReportCommenting();
  const canMark: boolean = image.width > 0 && image.height > 0;
  const target: ImageTarget | undefined =
    commenting.isEnabled && canMark && !isBroken ? areaTarget : undefined;
  const areas: readonly PictureArea[] =
    target === undefined ? NO_AREAS : commenting.areasOfImage(target);

  function finishArea(event: MouseEvent<HTMLElement>): void {
    const frame: HTMLDivElement | null = innerRef.current;
    if (frame === null || target === undefined) {
      return;
    }
    const box: DOMRect = event.currentTarget.getBoundingClientRect();
    const size = { width: box.width, height: box.height };
    // Ohne Zeigerbewegung (Tastatur: Enter) liegt der Bereich um die Bildmitte.
    const start: { x: number; y: number } = drag?.start ?? {
      x: size.width / 2,
      y: size.height / 2,
    };
    const rect: AreaRect = areaFromCorners(start, drag?.end ?? start, size);
    setDrag(null);
    setIsDrawing(false);
    commenting.commentOnArea(areaAnchor(frame, rect), target, rect);
  }

  function renderDrawLayer(): ReactElement {
    return (
      <button
        type="button"
        className="report-picture__draw"
        aria-label={AREA_DRAW_LABEL}
        onPointerDown={(event: PointerEvent<HTMLButtonElement>): void => {
          event.currentTarget.setPointerCapture(event.pointerId);
          const point = pointOf(event);
          setDrag({ start: point, end: point });
        }}
        onPointerMove={(event: PointerEvent<HTMLButtonElement>): void => {
          if (drag !== null) {
            setDrag({ start: drag.start, end: pointOf(event) });
          }
        }}
        onPointerCancel={(): void => {
          setDrag(null);
        }}
        onClick={finishArea}
      >
        {drag !== null && (
          <span
            className="report-picture__area report-picture__area--pending"
            style={dragStyle(drag)}
          />
        )}
      </button>
    );
  }

  function renderImage(): ReactElement {
    if (image.url === '' || isBroken) {
      return <p className="report-picture__missing">{IMAGE_MISSING_TEXT}</p>;
    }
    const picture: ReactElement = (
      <img
        src={image.url}
        alt={alt}
        width={image.width}
        height={image.height}
        onError={(): void => {
          setIsBroken(true);
        }}
      />
    );
    if (onOpen === undefined) {
      return picture;
    }
    return (
      <button
        type="button"
        className="report-picture__open"
        title={ZOOM_LABEL}
        aria-label={`${ZOOM_LABEL}: ${alt}`}
        onClick={onOpen}
      >
        {picture}
      </button>
    );
  }

  return (
    <div className={`report-picture${isNarrow ? ' report-picture--narrow' : ''}`}>
      {target !== undefined && (
        <div className="report-picture__tools">
          {isDrawing && <span className="report-picture__hint">{AREA_DRAW_HINT}</span>}
          <ReportCommentButton
            label={AREA_COMMENT_LABEL}
            isPressed={isDrawing}
            onComment={(): void => {
              setDrag(null);
              setIsDrawing(!isDrawing);
            }}
          />
        </div>
      )}
      <div ref={innerRef} className="report-picture__inner">
        {renderImage()}
        {areas.map((area: PictureArea) => (
          <span
            key={area.key}
            className={`report-picture__area${area.isPending ? ' report-picture__area--pending' : ''}`}
            style={rectStyle(area.rect)}
            title={area.text === '' ? undefined : area.text}
          >
            {!area.isPending && <ReportIcon name="msg" />}
          </span>
        ))}
        {isDrawing && renderDrawLayer()}
        {canMark &&
          !isBroken &&
          marks.map((mark: ReportMark) => (
            <button
              key={mark.n}
              type="button"
              className={`report-picture__mark${hotMark === mark.n ? ' report-picture__mark--hot' : ''}`}
              style={markStyle(mark, image)}
              aria-label={`Marke ${String(mark.n)}${mark.text === null ? '' : `: ${mark.text}`}`}
              onMouseEnter={(): void => {
                onHotMark(mark.n);
              }}
              onMouseLeave={(): void => {
                onHotMark(null);
              }}
              onFocus={(): void => {
                onHotMark(mark.n);
              }}
              onBlur={(): void => {
                onHotMark(null);
              }}
            >
              <span className="report-picture__number">{mark.n}</span>
            </button>
          ))}
      </div>
      {target !== undefined && <ReportCommentCards comments={commenting.commentsOfImage(target)} />}
    </div>
  );
}
