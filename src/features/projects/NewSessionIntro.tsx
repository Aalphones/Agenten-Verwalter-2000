import type { ReactElement } from 'react';
import './NewSessionIntro.css';

interface NewSessionIntroProps {
  projectName: string;
  /** Nummer der neuen Session im Vorhaben, ab 2. */
  number: number;
}

export function NewSessionIntro({ projectName, number }: NewSessionIntroProps): ReactElement {
  const previous: number = number - 1;
  const history: string = previous <= 1 ? '#1' : `#1 bis #${String(previous)}`;
  return (
    <div className="new-session-intro">
      <div className="new-session-intro__column">
        <h2 className="new-session-intro__title">Neue Session im Vorhaben „{projectName}“</h2>
        <p className="new-session-intro__text">
          Startet mit leerem Kontext, ohne den Verlauf von {history}. Modell, Modus und Denkaufwand
          sind aus #{previous} übernommen und lassen sich unten vor der ersten Nachricht ändern.
        </p>
      </div>
    </div>
  );
}
