import type { ReactElement } from 'react';
import { HandoffButton } from '@/features/chat/HandoffButton';
import { handoffExcerpt } from '@/features/chat/handoff';
import { ProjectHandoffButton } from '@/features/chat/ProjectHandoffButton';
import type { HandoffLine } from '@/lib/bindings/HandoffLine';
import type { SessionSummary } from '@/lib/bindings/SessionSummary';
import './HandoffBar.css';

interface HandoffBarProps {
  projectId: string;
  /** Einstiegszeilen der letzten Antwort in Antwort-Reihenfolge. */
  lines: readonly HandoffLine[];
  /** Nimmt die angelegte Session in die Liste und wählt sie aus (`handleSessionCreated` in `App`). */
  onSessionCreated: (created: SessionSummary) => void;
}

/** Eine Reihe je Einstiegszeile unter der Antwort; Art und Zeilenanfang nur, wenn es mehrere gibt. */
export function HandoffBar({ projectId, lines, onSessionCreated }: HandoffBarProps): ReactElement {
  return (
    <div className="handoff-bar">
      {lines.map((line: HandoffLine, index: number) => (
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
    </div>
  );
}
