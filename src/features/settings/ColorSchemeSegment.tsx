import type { ReactElement } from 'react';
import type { ColorScheme } from '@/lib/bindings/ColorScheme';

interface SchemeOption {
  readonly id: ColorScheme;
  readonly label: string;
}

const SCHEME_OPTIONS: readonly SchemeOption[] = [
  { id: 'dark', label: 'Dunkel' },
  { id: 'light', label: 'Hell' },
  { id: 'system', label: 'System' },
] as const;

interface ColorSchemeSegmentProps {
  value: ColorScheme;
  onChange: (scheme: ColorScheme) => void;
}

/** Stile stehen in `SettingsView.css` unter `settings-view__segment`. */
export function ColorSchemeSegment({ value, onChange }: ColorSchemeSegmentProps): ReactElement {
  return (
    <div className="settings-view__segment" role="group" aria-label="Farbschema">
      {SCHEME_OPTIONS.map((option: SchemeOption) => {
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
