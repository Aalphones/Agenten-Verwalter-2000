import type { ReactElement, ReactNode } from 'react';
import './TldrButton.css';

export type TldrButtonVariant = 'icon' | 'compact' | 'bar';

interface TldrButtonProps {
  variant: TldrButtonVariant;
  /** Text für Knöpfe ohne sichtbare Beschriftung. */
  ariaLabel?: string;
  title?: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}

export function TldrButton({
  variant,
  ariaLabel,
  title,
  disabled = false,
  onClick,
  children,
}: TldrButtonProps): ReactElement {
  return (
    <button
      type="button"
      className={`tldr-button tldr-button--${variant}`}
      aria-label={ariaLabel}
      title={title}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
