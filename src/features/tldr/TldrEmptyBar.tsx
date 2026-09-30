import type { ReactElement } from 'react';
import { TldrButton } from '@/features/tldr/TldrButton';
import { TldrIcon } from '@/features/tldr/TldrIcon';
import './TldrEmptyBar.css';

interface TldrEmptyBarProps {
  text: string;
  /** Nur bei der Session: welches Modell den Lauf macht. */
  hint?: string;
  disabled: boolean;
  onCreate: () => void;
}

/** Gestrichelte Leiste „noch keins“: zeigt, dass etwas fehlt, ohne wie ein Fehler auszusehen. */
export function TldrEmptyBar({ text, hint, disabled, onCreate }: TldrEmptyBarProps): ReactElement {
  return (
    <div className="tldr-empty-bar">
      <span className="tldr-empty-bar__label">TL;DR</span>
      <span className="tldr-empty-bar__text">{text}</span>
      {hint !== undefined && <span className="tldr-empty-bar__hint">{hint}</span>}
      <TldrButton variant="bar" disabled={disabled} onClick={onCreate}>
        <TldrIcon name="listPlus" size={13} />
        TL;DR erstellen
      </TldrButton>
    </div>
  );
}
