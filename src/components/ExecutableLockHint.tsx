import type { ReactElement } from 'react';
import './ExecutableLockHint.css';

interface ExecutableLockHintProps {
  /** Wird vom gesperrten Knopf per `aria-describedby` genannt. */
  id: string;
}

/** Die Zeile unter dem Kopf einer ausführbaren Datei: sagt, warum „Mit Standardprogramm öffnen“ gesperrt ist
 *  (ADR 071). */
export function ExecutableLockHint({ id }: ExecutableLockHintProps): ReactElement {
  return (
    <span id={id} className="executable-lock-hint">
      ⚠ Standardprogramm gesperrt: würde das Skript ausführen
    </span>
  );
}
