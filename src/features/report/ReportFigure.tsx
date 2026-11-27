import { useState } from 'react';
import type { ReactElement } from 'react';
import { ReportDiagram } from '@/features/report/ReportDiagram';
import { ReportFigureFrame } from '@/features/report/ReportFigureFrame';
import { ReportIcon } from '@/features/report/ReportIcon';
import { ReportLightbox } from '@/features/report/ReportLightbox';
import { ReportMarkLegend } from '@/features/report/ReportMarkLegend';
import { ReportPicture } from '@/features/report/ReportPicture';
import type { ImageTarget } from '@/features/report/reportCommentsContext';
import { ZOOM_LABEL } from '@/features/report/reportTexts';
import type { ReportFigure } from '@/lib/bindings/ReportFigure';
import type { ReportImage } from '@/lib/bindings/ReportImage';

/** Ein Bild-Eintrag hat genau ein Bild. */
const FIGURE_IMAGE_KEY = 'bild';

interface ReportFigureBlockProps {
  /** Bereich der Phase (`scopeOf`) für die gewählte Ansicht eines Schaubilds. */
  scope: string;
  figure: ReportFigure;
}

interface ReportFigureImageProps {
  figure: ReportFigure;
  image: ReportImage;
}

/** Ein Bild mit Marken, Legende und Kommentar; Klick öffnet es groß. */
function ReportFigureImage({ figure, image }: ReportFigureImageProps): ReactElement {
  const [hotMark, setHotMark] = useState<number | null>(null);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const areaTarget: ImageTarget = {
    entry: figure.entry,
    label: figure.caption,
    imageKey: FIGURE_IMAGE_KEY,
  };

  function open(): void {
    setIsOpen(true);
  }

  return (
    <ReportFigureFrame
      icon="image"
      caption={figure.caption}
      by={figure.by}
      actions={
        <button type="button" className="report-figure__action" onClick={open}>
          <ReportIcon name="max" />
          {ZOOM_LABEL}
        </button>
      }
    >
      <ReportPicture
        image={image}
        marks={figure.marks}
        alt={figure.caption}
        isNarrow={false}
        hotMark={hotMark}
        onHotMark={setHotMark}
        onOpen={open}
        areaTarget={areaTarget}
      />
      <ReportMarkLegend marks={figure.marks} hotMark={hotMark} onHotMark={setHotMark} />
      {figure.text !== null && <p className="report-figure__text">{figure.text}</p>}
      {isOpen && (
        <ReportLightbox
          zoom={{ title: figure.caption, image, marks: figure.marks, areaTarget }}
          onClose={(): void => {
            setIsOpen(false);
          }}
        />
      )}
    </ReportFigureFrame>
  );
}

/** Ein `report_figure`: Schaubild (Mermaid) oder Bild mit Marken. */
export function ReportFigureBlock({ scope, figure }: ReportFigureBlockProps): ReactElement | null {
  if (figure.mermaid !== null) {
    return <ReportDiagram scope={scope} figure={figure} mermaid={figure.mermaid} />;
  }
  if (figure.image !== null) {
    return <ReportFigureImage figure={figure} image={figure.image} />;
  }
  return null;
}
