import { useState } from 'react';
import type { ReactElement } from 'react';
import { AUTO_HANDOFF_TITLE } from '@/features/chat/handoff';
import { Switch } from '@/components/Switch';
import { commandErrorText } from '@/lib/errors';
import { setProjectAutoHandoff } from '@/lib/projects';
import './AutoHandoffSwitch.css';

interface AutoHandoffSwitchProps {
  projectId: string;
  /** Stand aus dem Vorhaben; der Schalter zeigt nie mehr als das, auch nicht während des Speicherns. */
  enabled: boolean;
  label: string;
  /** Label links, Schalter rechts über die volle Breite (Übersicht). */
  wide?: boolean;
}

/** Schalter „Automatisch weiter“ mit Info-Symbol; Übersicht und Antwort zeigen denselben Stand. */
export function AutoHandoffSwitch({
  projectId,
  enabled,
  label,
  wide = false,
}: AutoHandoffSwitchProps): ReactElement {
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleChange(next: boolean): Promise<void> {
    setIsSaving(true);
    setErrorMessage(null);
    try {
      await setProjectAutoHandoff(projectId, next);
    } catch (reason: unknown) {
      console.error('„Automatisch weiter“ nicht gespeichert', reason);
      setErrorMessage(`Nicht gespeichert: ${commandErrorText(reason)}`);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="auto-handoff-switch-wrap">
      <div className={`auto-handoff-switch${wide ? ' auto-handoff-switch--wide' : ''}`}>
        <span className="auto-handoff-switch__label">{label}</span>
        <span className="auto-handoff-switch__info" title={AUTO_HANDOFF_TITLE}>
          <svg
            width="13"
            height="13"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="7" cy="7" r="5.5" />
            <path d="M7 6.4v3.4" />
            <circle cx="7" cy="4.3" r="0.5" fill="currentColor" />
          </svg>
        </span>
        <Switch
          checked={enabled}
          label={label}
          disabled={isSaving}
          onChange={(next: boolean) => {
            void handleChange(next);
          }}
        />
      </div>
      {errorMessage !== null && (
        <p className="auto-handoff-switch__error" role="alert">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
