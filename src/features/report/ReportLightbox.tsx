import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { Dialog } from '@/components/Dialog';
import { ReportMarkLegend } from '@/features/report/ReportMarkLegend';
import { ReportPicture } from '@/features/report/ReportPicture';
import {
  useReportCommenting,
  type ImageTarget,
  type ReportCommenting,
} from '@/features/report/reportCommentsContext';
import { CLOSE_LABEL } from '@/features/report/reportTexts';
import type { ReportImage } from '@/lib/bindings/ReportImage';
import type { ReportMark } from '@/lib/bindings/ReportMark';
import './ReportLightbox.css';

const TITLE_ID = 'report-lightbox-title';

/** Was der Lichtkasten zeigt: ein Bild mit Titel und Marken. */
export interface ReportZoom {
  title: string;
  image: ReportImage;
  marks: readonly ReportMark[];
  /** Ziel für Bereichs-Kommentare auf diesem Bild. */
  areaTarget?: ImageTarget;
}

interface ReportLightboxProps {
  zoom: ReportZoom;
  onClose: () => void;
}

/** Bild in groß, Marken an ihrer Stelle, Legende darunter. Schließt mit dem Knopf, Escape oder Klick daneben. */
export function ReportLightbox({ zoom, onClose }: ReportLightboxProps): ReactElement {
  const [hotMark, setHotMark] = useState<number | null>(null);
  const commenting: ReportCommenting = useReportCommenting();
  const { closeComposer, isComposerOpen } = commenting;

  // Das Kommentarfeld hängt am Bild; ohne das Bild bliebe es ohne Stelle stehen.
  useEffect(() => closeComposer, [closeComposer]);

  // Escape (und ein Klick daneben) schließt zuerst das Kommentarfeld, erst dann das Bild.
  function handleDialogClose(): void {
    if (isComposerOpen) {
      closeComposer();
      return;
    }
    onClose();
  }

  return (
    <Dialog labelledBy={TITLE_ID} className="report-lightbox" onClose={handleDialogClose}>
      <header className="report-lightbox__head">
        <h2 id={TITLE_ID} className="report-lightbox__title">
          {zoom.title}
        </h2>
        <button type="button" className="report-lightbox__close" onClick={onClose}>
          {CLOSE_LABEL}
        </button>
      </header>
      <div className="report-lightbox__body">
        <ReportPicture
          image={zoom.image}
          marks={zoom.marks}
          alt={zoom.title}
          isNarrow={false}
          hotMark={hotMark}
          onHotMark={setHotMark}
          areaTarget={zoom.areaTarget}
        />
        <ReportMarkLegend marks={zoom.marks} hotMark={hotMark} onHotMark={setHotMark} />
      </div>
    </Dialog>
  );
}
