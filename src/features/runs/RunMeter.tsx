import type { ReactElement, ReactNode } from 'react';
import type { RunKind } from '@/features/runs/runTexts';
import './RunMeter.css';

const PERCENT = 100;

interface RunMeterProps {
  /** Ohne Balken (`none`) wird die Komponente nicht gebraucht. */
  kind: Exclude<RunKind, 'none'>;
  /** Füllung, 0 bis 1. */
  fraction: number;
  /** Wert neben dem Balken; leer lässt nur den Balken stehen. */
  valueLabel: string;
  /** Figur, die auf dem Balken mitläuft; am Ende der Spur steht dann eine Fahne und über dem Balken ist Platz. */
  rider?: ReactNode;
}

/** Balken eines Laufs: gemessen voll gefüllt, geschätzt schraffiert, überzogen schraffiert in Warnfarbe. */
export function RunMeter({ kind, fraction, valueLabel, rider }: RunMeterProps): ReactElement {
  const percent: number = Math.round(fraction * PERCENT);
  return (
    <span className="run-meter">
      <span
        className={`run-meter__bar run-meter__bar--${kind}${rider === undefined ? '' : ' run-meter__bar--rider'}`}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={PERCENT}
        aria-valuenow={percent}
        aria-label={kind === 'measured' ? 'Fortschritt' : 'Geschätzter Fortschritt'}
      >
        <span className="run-meter__fill" style={{ width: `${String(percent)}%` }} />
        {rider !== undefined && <span className="run-meter__flag" aria-hidden="true" />}
        {rider}
      </span>
      {valueLabel !== '' && <span className="run-meter__value">{valueLabel}</span>}
    </span>
  );
}
