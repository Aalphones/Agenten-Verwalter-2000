import type { ReactElement, ReactNode } from 'react';
import { RunMeter } from '@/features/runs/RunMeter';
import type { RunView } from '@/features/runs/runTexts';
import { formatElapsed } from '@/features/skins/statusText';
import './WorkingIndicator.css';

interface WorkingIndicatorProps {
  /** Was gerade läuft, schon mit eingesetztem Ziel. */
  text: string;
  /** Werkzeug-Aufrufe seit der letzten Nachricht des Users. */
  calls: number;
  /** Text des aktiven Todos; `null` ohne. */
  todo: string | null;
  /** Sekunden des Denkens; `null`, wenn der Agent nicht denkt. */
  thinkingSeconds: number | null;
  /** Der Lauf eines Befehls ab 2 s; `null` ohne. Dann stehen Zähler und Todo nicht in der Zeile. */
  run: RunView | null;
  /** Figur vor dem Text; ohne Skin leer. */
  figure?: ReactNode;
  /** „· Esc unterbricht“; beim Warten auf ein Skript läuft nichts, das Esc unterbrechen könnte. */
  showsHint?: boolean;
}

function countLabel(calls: number, thinkingSeconds: number | null): string | null {
  if (thinkingSeconds !== null) {
    return `· ${String(thinkingSeconds)} s`;
  }
  if (calls === 0) {
    return null;
  }
  return calls === 1 ? '· 1 Aufruf' : `· ${String(calls)} Aufrufe`;
}

function elapsedLabel(run: RunView): string {
  const clock: string = formatElapsed(run.elapsedSeconds);
  return run.kind === 'none' ? `· läuft ${clock}` : `· ${clock}`;
}

export function WorkingIndicator({
  text,
  calls,
  todo,
  thinkingSeconds,
  run,
  figure,
  showsHint = true,
}: WorkingIndicatorProps): ReactElement {
  const count: string | null = run === null ? countLabel(calls, thinkingSeconds) : null;
  const lastLine: string | null = run?.lastLine ?? null;

  function renderRun(view: RunView): ReactElement {
    return (
      <>
        <span className="working-indicator__count">{elapsedLabel(view)}</span>
        {view.kind !== 'none' && view.fraction !== null && (
          <RunMeter kind={view.kind} fraction={view.fraction} valueLabel={view.valueLabel} />
        )}
        {view.kind === 'overdue' && view.expectedLabel !== null && (
          <span className="working-indicator__late">länger als üblich ({view.expectedLabel})</span>
        )}
        {view.restLabel !== null && (
          <span className="working-indicator__count">· noch {view.restLabel}</span>
        )}
        {view.kind === 'none' && view.lastLine === null && (
          <span className="working-indicator__hint">· noch keine Ausgabe</span>
        )}
      </>
    );
  }

  return (
    <div className="working-indicator">
      <div
        className={`working-indicator__main${run === null ? '' : ' working-indicator__main--run'}`}
      >
        {figure ?? (
          <svg
            width="13"
            height="13"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M7 1.5v11M1.5 7h11M3 3l8 8M11 3 3 11" />
          </svg>
        )}
        <span key={text} className="working-indicator__label" title={text}>
          {text}
        </span>
        {run !== null && renderRun(run)}
        {count !== null && <span className="working-indicator__count">{count}</span>}
        {run === null && todo !== null && <span className="working-indicator__todo">{todo}</span>}
        {showsHint && <span className="working-indicator__hint">· Esc unterbricht</span>}
      </div>
      {lastLine !== null && (
        <div
          className={`working-indicator__last${figure === undefined ? '' : ' working-indicator__last--figure'}`}
        >
          <span aria-hidden="true">⎿</span>
          <span className="working-indicator__last-text" title={lastLine}>
            {lastLine}
          </span>
        </div>
      )}
    </div>
  );
}
