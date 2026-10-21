import type { ReactElement } from 'react';
import { DeniedIcon } from '@/features/notices/NoticeIcons';
import { COST_TITLE, costText, deniedCallsText } from '@/features/notices/noticeTexts';
import type { Denial } from '@/lib/bindings/Denial';
import './TurnSummaryLine.css';

const ICON_SIZE = 13;

interface TurnSummaryLineProps {
  denials: readonly Denial[];
  costUsd: number | null;
  isExpanded: boolean;
  onToggle: () => void;
}

export function TurnSummaryLine({
  denials,
  costUsd,
  isExpanded,
  onToggle,
}: TurnSummaryLineProps): ReactElement {
  return (
    <div className="turn-summary">
      {denials.length > 0 && (
        <div className="turn-summary__denied">
          <button
            type="button"
            className="turn-summary__toggle"
            aria-expanded={isExpanded}
            onClick={onToggle}
          >
            <DeniedIcon size={ICON_SIZE} />
            <span>{deniedCallsText(denials.length)}</span>
            <span aria-hidden="true">{isExpanded ? '▾' : '▸'}</span>
          </button>
          {isExpanded && (
            <ul className="turn-summary__list">
              {denials.map((denial: Denial, index: number) => (
                <li key={`${String(index)}:${denial.tool}`}>
                  <strong>{denial.tool}</strong> {denial.target}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {costUsd !== null && (
        <span className="turn-summary__cost" title={COST_TITLE}>
          {costText(costUsd)}
        </span>
      )}
    </div>
  );
}
