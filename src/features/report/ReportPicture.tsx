import { useState } from 'react';
import type { CSSProperties, ReactElement } from 'react';
import { IMAGE_MISSING_TEXT, ZOOM_LABEL } from '@/features/report/reportTexts';
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
}

const PERCENT = 100;

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
}: ReportPictureProps): ReactElement {
  const [isBroken, setIsBroken] = useState<boolean>(false);
  const canMark: boolean = image.width > 0 && image.height > 0;

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
      <div className="report-picture__inner">
        {renderImage()}
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
    </div>
  );
}
