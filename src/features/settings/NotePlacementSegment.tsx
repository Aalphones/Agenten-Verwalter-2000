import type { ReactElement } from 'react';
import type { NotePlacement } from '@/lib/bindings/NotePlacement';

interface PlacementOption {
  readonly id: NotePlacement;
  readonly label: string;
}

const PLACEMENT_OPTIONS: readonly PlacementOption[] = [
  { id: 'dock', label: 'Im Terminal-Dock' },
  { id: 'tab', label: 'Als Reiter oben' },
] as const;

interface NotePlacementSegmentProps {
  value: NotePlacement;
  onChange: (placement: NotePlacement) => void;
}

/** Stile stehen in `SettingsView.css` unter `settings-view__segment`. */
export function NotePlacementSegment({ value, onChange }: NotePlacementSegmentProps): ReactElement {
  return (
    <div className="settings-view__segment" role="group" aria-label="Notiz">
      {PLACEMENT_OPTIONS.map((option: PlacementOption) => {
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
