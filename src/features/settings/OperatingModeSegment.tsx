import type { ReactElement } from 'react';
import type { OperatingMode } from '@/lib/bindings/OperatingMode';
import { OPERATING_MODE_OPTIONS } from '@/lib/labels';
import type { OperatingModeOption } from '@/lib/labels';

interface OperatingModeSegmentProps {
  value: OperatingMode;
  onChange: (operatingMode: OperatingMode) => void;
}

/** Stile stehen in `SettingsView.css` unter `settings-view__segment`. */
export function OperatingModeSegment({ value, onChange }: OperatingModeSegmentProps): ReactElement {
  return (
    <div className="settings-view__segment" role="group" aria-label="Betriebsart">
      {OPERATING_MODE_OPTIONS.map((option: OperatingModeOption) => {
        const isPressed: boolean = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            className={`settings-view__segment-button${isPressed ? ' settings-view__segment-button--pressed' : ''}`}
            aria-pressed={isPressed}
            onClick={(): void => {
              onChange(option.id);
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
