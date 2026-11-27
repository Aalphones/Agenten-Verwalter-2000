import type { ReactElement } from 'react';
import { ReportFigureFrame } from '@/features/report/ReportFigureFrame';
import { ReportIcon } from '@/features/report/ReportIcon';
import { REVIEW_DIAGRAM_PLACEHOLDER, REVIEW_TITLE } from '@/features/report/reportTexts';
import type { ReportFigure } from '@/lib/bindings/ReportFigure';
import type { ReportFinding } from '@/lib/bindings/ReportFinding';
import type { ReportReview } from '@/lib/bindings/ReportReview';
import './ReportReviewSection.css';

const NO_FINDINGS_TEXT = 'keine Befunde';

interface ReportReviewSectionProps {
  review: ReportReview;
  hasStop: (index: number) => boolean;
  onJumpToStop: (index: number) => void;
  onOpenFile: (repositoryKey: string, path: string, line: number | null) => void;
}

/** Befunde der Review-Station einer Phase: offene zuerst, behobene eingeklappt, dazu der Platz für ihr Schaubild. */
export function ReportReviewSection({
  review,
  hasStop,
  onJumpToStop,
  onOpenFile,
}: ReportReviewSectionProps): ReactElement {
  const total: number = review.open.length + review.resolved.length;
  const summary: string =
    total === 0
      ? NO_FINDINGS_TEXT
      : `${String(review.open.length)} offen · ${String(review.resolved.length)} behoben`;

  function renderFinding(finding: ReportFinding, isResolved: boolean): ReactElement {
    const location = finding.location;
    const stop: number | null = finding.stop;
    function renderTarget(): ReactElement | null {
      if (stop !== null && hasStop(stop)) {
        return (
          <button
            type="button"
            className="report-review__link"
            onClick={(): void => {
              onJumpToStop(stop);
            }}
          >
            <code>zum Stopp ↓</code>
          </button>
        );
      }
      if (location === null) {
        return null;
      }
      const name: string = location.path.slice(location.path.lastIndexOf('/') + 1);
      return (
        <button
          type="button"
          className="report-review__link"
          onClick={(): void => {
            onOpenFile(location.repositoryKey, location.path, location.line);
          }}
        >
          <code>{`${name}:${String(location.line)}`}</code>
        </button>
      );
    }
    return (
      <li
        key={finding.entry}
        className={`report-review__finding${isResolved ? ' report-review__finding--resolved' : ''}`}
      >
        <ReportIcon name={isResolved ? 'check' : 'flag'} />
        <span>{finding.text}</span>
        {renderTarget()}
      </li>
    );
  }

  return (
    <section className="report-review">
      <h3 className="report-review__title">
        {REVIEW_TITLE} {review.by}
        <span className="report-review__summary">{summary}</span>
      </h3>
      {review.open.length > 0 && (
        <ul className="report-review__list">
          {review.open.map((finding: ReportFinding) => renderFinding(finding, false))}
        </ul>
      )}
      {review.figures.map((figure: ReportFigure) => (
        <ReportFigureFrame
          key={`figure-${String(figure.entry)}`}
          figure={figure}
          placeholder={REVIEW_DIAGRAM_PLACEHOLDER}
        />
      ))}
      {review.resolved.length > 0 && (
        <details className="report-review__done">
          <summary>{review.resolved.length} behoben</summary>
          <ul className="report-review__list">
            {review.resolved.map((finding: ReportFinding) => renderFinding(finding, true))}
          </ul>
        </details>
      )}
    </section>
  );
}
