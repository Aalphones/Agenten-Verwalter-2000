import type { ReactElement } from 'react';

interface LanguageOption {
  /** Whisper-Sprachcode; `null` = automatische Erkennung. */
  readonly code: string | null;
  readonly label: string;
}

const LANGUAGE_OPTIONS: readonly LanguageOption[] = [
  { code: null, label: 'Automatisch' },
  { code: 'de', label: 'Deutsch' },
  { code: 'en', label: 'Englisch' },
] as const;

interface VoiceLanguageSegmentProps {
  value: string | null;
  onChange: (code: string | null) => void;
}

/** Stile stehen in `SettingsView.css` unter `settings-view__segment`. */
export function VoiceLanguageSegment({ value, onChange }: VoiceLanguageSegmentProps): ReactElement {
  return (
    <div className="settings-view__segment" role="group" aria-label="Sprache der Spracheingabe">
      {LANGUAGE_OPTIONS.map((option: LanguageOption) => {
        const isPressed: boolean = option.code === value;
        return (
          <button
            key={option.code ?? 'auto'}
            type="button"
            className={`settings-view__segment-button${isPressed ? ' settings-view__segment-button--pressed' : ''}`}
            aria-pressed={isPressed}
            onClick={(): void => {
              onChange(option.code);
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
