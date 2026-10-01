import type { ReactElement, ReactNode } from 'react';
import './SelectButton.css';

interface SelectButtonProps {
  /** Beschriftung der Zeile, für den Screenreader-Namen. */
  label: string;
  value: string;
  isOpen: boolean;
  onToggle: () => void;
  /** Das Menü; wird nur gerendert, solange `isOpen` gilt. */
  children: ReactNode;
}

/** Auswahlknopf, an dem ein Menü hängt. Die Hülle ist `position: relative`, damit das Menü am Knopf sitzt (Vertrag von `Popover`). */
export function SelectButton({
  label,
  value,
  isOpen,
  onToggle,
  children,
}: SelectButtonProps): ReactElement {
  return (
    <div className="select-button">
      <button
        type="button"
        className="select-button__trigger"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={`${label}: ${value}`}
        onClick={onToggle}
      >
        <span className="select-button__value">{value}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3.5 5.5 7 9l3.5-3.5" />
        </svg>
      </button>
      {isOpen && children}
    </div>
  );
}
