import type { ReactElement } from 'react';
import type { Effort } from '@/lib/bindings/Effort';
import type { Mode } from '@/lib/bindings/Mode';
import { MODE_OPTIONS } from '@/lib/labels';
import type { ModeOption } from '@/lib/labels';
import { EffortDots } from '@/components/EffortDots';
import { Popover } from '@/components/Popover';
import './ModeMenu.css';

const MODE_MENU_WIDTH = 430;

interface ModeMenuProps {
  mode: Mode;
  effort: Effort;
  onModeChange: (mode: Mode) => void;
  onEffortChange: (effort: Effort) => void;
  onClose: () => void;
  placement: 'above' | 'below';
  align?: 'start' | 'end';
}

export function ModeMenu({
  mode,
  effort,
  onModeChange,
  onEffortChange,
  onClose,
  placement,
  align = 'end',
}: ModeMenuProps): ReactElement {
  return (
    <Popover
      label="Modus"
      placement={placement}
      align={align}
      width={MODE_MENU_WIDTH}
      onClose={onClose}
    >
      <div className="mode-menu__head">
        <span className="mode-menu__title">Modus</span>
        <kbd className="mode-menu__key">Umschalt + Tab</kbd>
      </div>
      {MODE_OPTIONS.map((option: ModeOption) => {
        const isChecked: boolean = option.id === mode;
        return (
          <button
            key={option.id}
            type="button"
            role="menuitemradio"
            aria-checked={isChecked}
            className={`mode-menu__item${isChecked ? ' mode-menu__item--checked' : ''}`}
            onClick={(): void => {
              onModeChange(option.id);
            }}
          >
            <span className="mode-menu__icon">{option.icon}</span>
            <span className="mode-menu__text">
              <span className="mode-menu__name">{option.label}</span>
              <span className="mode-menu__hint">{option.hint}</span>
            </span>
            {isChecked && <CheckMark />}
          </button>
        );
      })}
      <div className="mode-menu__foot">
        <EffortDots value={effort} onChange={onEffortChange} />
      </div>
    </Popover>
  );
}

function CheckMark(): ReactElement {
  return (
    <svg className="mode-menu__check" width="14" height="14" viewBox="0 0 12 12" aria-hidden="true">
      <path
        d="M2.4 6.3 4.9 8.7 9.6 3.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
