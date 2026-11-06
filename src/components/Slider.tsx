import { type ReactElement, useState } from 'react';
import './Slider.css';

interface SliderProps {
  value: number;
  min: number;
  max: number;
  step: number;
  /** Zugänglicher Name; der sichtbare Text steht in der Zeile daneben. */
  label: string;
  /** Text für den aktuellen Wert, z. B. „250k Tokens“. */
  format: (value: number) => string;
  disabled?: boolean;
  /** Wird erst beim Loslassen bzw. nach einer Pfeiltaste gerufen, nicht bei jeder Bewegung. */
  onCommit: (value: number) => void;
}

/** Regler für eine Zahl in einem festen Bereich; zeigt den Wert rechts daneben an. */
export function Slider({
  value,
  min,
  max,
  step,
  label,
  format,
  disabled,
  onCommit,
}: SliderProps): ReactElement {
  const [draft, setDraft] = useState<number>(value);
  const [seenValue, setSeenValue] = useState<number>(value);

  // Ein neuer Wert von außen ersetzt den Entwurf (während des Renderns, kein Effekt nötig).
  if (seenValue !== value) {
    setSeenValue(value);
    setDraft(value);
  }

  const commit = (): void => {
    if (draft !== value) {
      onCommit(draft);
    }
  };

  return (
    <div className="slider">
      <input
        type="range"
        className="slider__input"
        aria-label={label}
        aria-valuetext={format(draft)}
        min={min}
        max={max}
        step={step}
        value={draft}
        disabled={disabled}
        onChange={(event) => {
          setDraft(Number(event.target.value));
        }}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
      />
      <span className="slider__value">{format(draft)}</span>
    </div>
  );
}
