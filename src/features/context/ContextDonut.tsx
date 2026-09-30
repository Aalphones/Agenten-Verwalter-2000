import type { ReactElement } from 'react';
import { contextSeverity } from '@/features/context/contextSeverity';
import '@/components/SeverityIcon.css';
import './ContextDonut.css';

const VIEW_BOX_SIZE = 18;
const CENTER = VIEW_BOX_SIZE / 2;
const STROKE_WIDTH = 3;
const RADIUS = CENTER - STROKE_WIDTH / 2;
const FULL_PERCENT = 100;

interface ContextDonutProps {
  /** Belegter Anteil des Kontext-Fensters in Prozent; alles außerhalb von 0 bis 100 wird gekappt. */
  percent: number;
  /** Kantenlänge in px. */
  size?: number;
}

/** Ring, der sich ab 12 Uhr im Uhrzeigersinn füllt: grün unter 60 %, gelb unter 80 %, rot darüber.
 *  Trägt keine Zahlen — die stehen im Kontext-Fenster. */
export function ContextDonut({ percent, size = 18 }: ContextDonutProps): ReactElement {
  const filled: number = Math.min(Math.max(percent, 0), FULL_PERCENT);
  return (
    <svg
      className={`context-donut severity severity--${contextSeverity(percent)}`}
      width={size}
      height={size}
      viewBox={`0 0 ${String(VIEW_BOX_SIZE)} ${String(VIEW_BOX_SIZE)}`}
      fill="none"
      strokeWidth={STROKE_WIDTH}
      aria-hidden="true"
    >
      <circle className="context-donut__track" cx={CENTER} cy={CENTER} r={RADIUS} />
      {filled > 0 && (
        <circle
          className="context-donut__fill"
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          pathLength={FULL_PERCENT}
          strokeDasharray={`${String(filled)} ${String(FULL_PERCENT)}`}
          transform={`rotate(-90 ${String(CENTER)} ${String(CENTER)})`}
        />
      )}
    </svg>
  );
}
