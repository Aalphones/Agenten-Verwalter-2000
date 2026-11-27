import type { ReactElement } from 'react';
import type { ReportZoom } from '@/features/report/ReportLightbox';
import {
  AFTER_LABEL,
  BEFORE_LABEL,
  STEPS_TITLE,
  STEP_COLUMNS,
  ZOOM_LABEL,
} from '@/features/report/reportTexts';
import type { ReportImage } from '@/lib/bindings/ReportImage';
import type { ReportStep } from '@/lib/bindings/ReportStep';
import './ReportSteps.css';

interface ReportStepsProps {
  steps: readonly ReportStep[];
  screenName: string;
  onOpenImage: (zoom: ReportZoom) => void;
}

interface ThumbProps {
  image: ReportImage;
  label: string;
  title: string;
  onOpenImage: (zoom: ReportZoom) => void;
}

/** Vorschaubild eines Schritts; Klick öffnet es groß. */
function Thumb({ image, label, title, onOpenImage }: ThumbProps): ReactElement {
  return (
    <button
      type="button"
      className="report-steps__thumb"
      title={`${label} ${ZOOM_LABEL.toLowerCase()}`}
      onClick={(): void => {
        onOpenImage({ title, image, marks: [] });
      }}
    >
      <img src={image.url} alt="" width={96} height={56} />
      <small>{label}</small>
    </button>
  );
}

/** Klickpfad eines Bildschirms: je Schritt öffnen, tun, erwartet, dazu Vorschau vorher und nachher. */
export function ReportSteps({ steps, screenName, onOpenImage }: ReportStepsProps): ReactElement {
  const [number, open, act, expect, picture] = STEP_COLUMNS;
  return (
    <table className="report-steps">
      <caption className="report-steps__title">{STEPS_TITLE}</caption>
      <thead>
        <tr>
          <th>{number}</th>
          <th>{open}</th>
          <th>{act}</th>
          <th>{expect}</th>
          <th>{picture}</th>
        </tr>
      </thead>
      <tbody>
        {steps.map((step: ReportStep, index: number) => (
          <tr key={`${String(index)}-${step.open}`}>
            <td className="report-steps__number">{index + 1}</td>
            <td data-label={open}>{step.open}</td>
            <td data-label={act}>{step.act}</td>
            <td data-label={expect}>{step.expect}</td>
            <td className="report-steps__pictures">
              {step.before !== null && (
                <Thumb
                  image={step.before}
                  label={BEFORE_LABEL}
                  title={`${screenName} · Schritt ${String(index + 1)} · ${BEFORE_LABEL}`}
                  onOpenImage={onOpenImage}
                />
              )}
              {step.after !== null && (
                <Thumb
                  image={step.after}
                  label={AFTER_LABEL}
                  title={`${screenName} · Schritt ${String(index + 1)} · ${AFTER_LABEL}`}
                  onOpenImage={onOpenImage}
                />
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
