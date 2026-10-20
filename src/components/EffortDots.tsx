import type { ReactElement } from 'react';
import type { Effort } from '@/lib/bindings/Effort';
import { EFFORT_OPTIONS, effortLabel } from '@/lib/labels';
import type { EffortOption } from '@/lib/labels';
import './EffortDots.css';

interface EffortDotsProps {
  value: Effort;
  onChange: (effort: Effort) => void;
  /** Die Stufen, die das Modell kennt; fehlt die Angabe, gelten alle. */
  efforts?: readonly Effort[] | undefined;
}

export function EffortDots({ value, onChange, efforts }: EffortDotsProps): ReactElement {
  const offered: readonly EffortOption[] =
    efforts === undefined
      ? EFFORT_OPTIONS
      : EFFORT_OPTIONS.filter((option: EffortOption) => efforts.includes(option.id));
  return (
    <div className="effort-dots">
      <span className="effort-dots__title">
        Denkaufwand <span className="effort-dots__value">({effortLabel(value)})</span>
      </span>
      <div className="effort-dots__group" role="group" aria-label="Denkaufwand">
        {offered.map((option: EffortOption) => {
          const isSelected: boolean = option.id === value;
          const isMax: boolean = option.id === 'max';
          const dotClass: string = [
            'effort-dots__dot',
            isSelected ? 'effort-dots__dot--selected' : '',
            isMax ? 'effort-dots__dot--max' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <button
              key={option.id}
              type="button"
              className="effort-dots__button"
              aria-label={`Denkaufwand ${option.label}`}
              aria-pressed={isSelected}
              onClick={(): void => {
                onChange(option.id);
              }}
            >
              <span className={dotClass} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
