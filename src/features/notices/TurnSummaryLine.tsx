import { useState } from 'react';
import type { ReactElement } from 'react';
import { DeniedIcon } from '@/features/notices/NoticeIcons';
import {
  COST_TITLE,
  costText,
  deniedCallsText,
  unsourcedPartsText,
  unsourcedText,
} from '@/features/notices/noticeTexts';
import type { Denial } from '@/lib/bindings/Denial';
import './TurnSummaryLine.css';

const ICON_SIZE = 13;

interface TurnSummaryLineProps {
  denials: readonly Denial[];
  costUsd: number | null;
  /** `seq` der Texte dieser Antwort mit Angaben ohne Fundstelle; leer, solange die Markierung aus ist. */
  unsourced: readonly number[];
  /** Summe der Angaben in den geladenen Texten; `null`, wenn einer der Texte nicht geladen ist. */
  unsourcedCount: number | null;
  onJump: (seq: number) => void;
  isExpanded: boolean;
  onToggle: () => void;
}

export function TurnSummaryLine({
  denials,
  costUsd,
  unsourced,
  unsourcedCount,
  onJump,
  isExpanded,
  onToggle,
}: TurnSummaryLineProps): ReactElement {
  const [jumpIndex, setJumpIndex] = useState<number>(0);

  function jumpToNext(): void {
    const target: number = jumpIndex % unsourced.length;
    const seq: number | undefined = unsourced[target];
    setJumpIndex(target + 1);
    if (seq !== undefined) {
      onJump(seq);
    }
  }

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
      {unsourced.length > 0 && (
        <button type="button" className="turn-summary__unsourced" onClick={jumpToNext}>
          {unsourcedCount === null
            ? unsourcedPartsText(unsourced.length)
            : unsourcedText(unsourcedCount)}
        </button>
      )}
      {costUsd !== null && (
        <span className="turn-summary__cost" title={COST_TITLE}>
          {costText(costUsd)}
        </span>
      )}
    </div>
  );
}
