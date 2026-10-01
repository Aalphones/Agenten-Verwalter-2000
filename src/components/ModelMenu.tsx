import type { ReactElement } from 'react';
import type { ModelId } from '@/lib/bindings/ModelId';
import { MODEL_OPTIONS } from '@/lib/labels';
import type { ModelOption } from '@/lib/labels';
import { Popover } from '@/components/Popover';
import './ModelMenu.css';

const MODEL_MENU_WIDTH = 340;

interface ModelMenuProps {
  value: ModelId;
  onChange: (model: ModelId) => void;
  onClose: () => void;
  placement: 'above' | 'below';
  note: string;
  title?: string;
}

export function ModelMenu({
  value,
  onChange,
  onClose,
  placement,
  note,
  title = 'Modell für diese Session',
}: ModelMenuProps): ReactElement {
  return (
    <Popover
      label="Modell"
      placement={placement}
      align="start"
      width={MODEL_MENU_WIDTH}
      onClose={onClose}
    >
      <div className="model-menu__head">{title}</div>
      {MODEL_OPTIONS.map((option: ModelOption) => {
        const isChecked: boolean = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            role="menuitemradio"
            aria-checked={isChecked}
            className={`model-menu__item${isChecked ? ' model-menu__item--checked' : ''}`}
            onClick={(): void => {
              onChange(option.id);
            }}
          >
            <span className="model-menu__text">
              <span className="model-menu__name">{option.name}</span>
              <span className="model-menu__hint">{option.hint}</span>
            </span>
            {isChecked && <CheckMark />}
          </button>
        );
      })}
      <div className="model-menu__foot">{note}</div>
    </Popover>
  );
}

function CheckMark(): ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 12 12" aria-hidden="true">
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
