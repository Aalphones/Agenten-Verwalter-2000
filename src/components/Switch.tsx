import type { ReactElement } from 'react';
import './Switch.css';

interface SwitchProps {
  checked: boolean;
  /** Zugänglicher Name; ein Schalter hat keinen sichtbaren Text. */
  label: string;
  title?: string;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

/** Ein-/Aus-Schalter; `onChange` bekommt den neuen Zustand. */
export function Switch({ checked, label, title, disabled, onChange }: SwitchProps): ReactElement {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={title}
      disabled={disabled}
      className={`switch${checked ? ' switch--on' : ''}`}
      onClick={() => {
        onChange(!checked);
      }}
    >
      <span className="switch__knob" />
    </button>
  );
}
