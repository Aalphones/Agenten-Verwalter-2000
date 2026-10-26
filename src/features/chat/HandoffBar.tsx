import type { ReactElement } from 'react';
import { AutoHandoffSwitch } from '@/features/chat/AutoHandoffSwitch';
import { HandoffButton } from '@/features/chat/HandoffButton';
import { HALT_TEXT, handoffExcerpt } from '@/features/chat/handoff';
import { ProjectHandoffButton } from '@/features/chat/ProjectHandoffButton';
import { useSecondsUntil } from '@/features/chat/useSecondsUntil';
import type { AutoHandoff } from '@/lib/bindings/AutoHandoff';
import type { HandoffLine } from '@/lib/bindings/HandoffLine';
import type { ModelId } from '@/lib/bindings/ModelId';
import type { SessionSummary } from '@/lib/bindings/SessionSummary';
import { modelName } from '@/lib/labels';
import { cancelAutoHandoff } from '@/lib/sessions';
import './HandoffBar.css';

interface HandoffBarProps {
  projectId: string;
  sessionId: string;
  /** Einstiegszeilen der letzten Antwort in Antwort-Reihenfolge. */
  lines: readonly HandoffLine[];
  /** Nimmt die angelegte Session in die Liste und wählt sie aus (`handleSessionCreated` in `App`). */
  onSessionCreated: (created: SessionSummary) => void;
  /** „Automatisch weiter“ des Vorhabens (ADR 040). */
  autoHandoff: boolean;
  /** Stand der Automatik unter dieser Antwort. */
  autoState: AutoHandoff | null;
}

/** Eine Reihe je Einstiegszeile unter der Antwort; Art und Zeilenanfang nur, wenn es mehrere gibt.
 *  Während des Countdowns ersetzt die Countdown-Zeile die Knöpfe „In neuer Session weiter“. */
export function HandoffBar({
  projectId,
  sessionId,
  lines,
  onSessionCreated,
  autoHandoff,
  autoState,
}: HandoffBarProps): ReactElement {
  const isCountdown: boolean = autoState?.kind === 'countdown';
  const visibleLines: readonly HandoffLine[] = isCountdown
    ? lines.filter((line: HandoffLine) => line.kind !== 'session')
    : lines;
  return (
    <div className="handoff-bar">
      {visibleLines.map((line: HandoffLine, index: number) => (
        <div key={index} className="handoff-bar__row">
          {lines.length > 1 && (
            <>
              <span className="handoff-bar__kind">
                {line.kind === 'session' ? 'Session' : 'Neues Vorhaben'}
              </span>
              <span className="handoff-bar__excerpt" title={line.text}>
                {handoffExcerpt(line)}
              </span>
            </>
          )}
          {line.kind === 'session' ? (
            <HandoffButton projectId={projectId} line={line} onSessionCreated={onSessionCreated} />
          ) : (
            <ProjectHandoffButton line={line} />
          )}
        </div>
      ))}
      {autoState?.kind === 'countdown' && (
        <AutoCountdown
          key={autoState.startsAt}
          sessionId={sessionId}
          startsAt={autoState.startsAt}
          model={autoState.model}
        />
      )}
      {autoState?.kind === 'failed' && (
        <p className="handoff-bar__error" role="alert">
          Automatischer Start gescheitert: {autoState.message}
        </p>
      )}
      {lines.some((line: HandoffLine) => line.kind === 'session') && (
        <div className="handoff-bar__foot">
          {autoState?.kind === 'halted' ? (
            <span className="handoff-bar__halt">{HALT_TEXT[autoState.reason]}</span>
          ) : (
            <span />
          )}
          <AutoHandoffSwitch
            projectId={projectId}
            enabled={autoHandoff}
            label="Automatisch weiter"
          />
        </div>
      )}
    </div>
  );
}

interface AutoCountdownProps {
  sessionId: string;
  startsAt: number;
  model: ModelId | null;
}

/** Je Countdown neu eingehängt (`key`), damit die Sekunden ab dem Erscheinen stimmen. */
function AutoCountdown({ sessionId, startsAt, model }: AutoCountdownProps): ReactElement {
  const seconds: number | null = useSecondsUntil(startsAt);
  const target: string = model === null ? 'auf dem bisherigen Modell' : `auf ${modelName(model)}`;

  function handleCancel(): void {
    // Der Countdown bleibt sichtbar, bis das nächste Ereignis ihn ändert.
    cancelAutoHandoff(sessionId).catch((reason: unknown) => {
      console.error('Automatisch weiter nicht abgebrochen', reason);
    });
  }

  return (
    <div className="handoff-bar__auto" role="status">
      <svg
        className="handoff-bar__auto-icon"
        width={14}
        height={14}
        viewBox="0 0 12 12"
        aria-hidden="true"
      >
        <circle cx="6" cy="6" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path
          d="M4 6h3.6M5.9 4.2 7.7 6 5.9 7.8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <p className="handoff-bar__auto-text">
        {seconds === 0 ? (
          <>Startet {target} …</>
        ) : (
          <>
            Startet automatisch in <b className="handoff-bar__seconds">{seconds} s</b> {target}
          </>
        )}
      </p>
      <button type="button" className="handoff-bar__cancel" onClick={handleCancel}>
        Abbrechen
      </button>
    </div>
  );
}
