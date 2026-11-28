import type { ReactElement } from 'react';
import { useStickToBottom } from '@/features/background/useStickToBottom';
import { showsResult, trailSteps } from '@/features/chat/subagentTrailContent';
import type { BackgroundItem } from '@/lib/bindings/BackgroundItem';
import type { SubagentStep } from '@/lib/bindings/SubagentStep';

const RESULT_PENDING = 'Ergebnis folgt, sobald der Subagent fertig ist.';
const STOPPED_ON_REQUEST = 'Beendet auf Wunsch.';

interface SubagentTrailProps {
  item: BackgroundItem;
}

/** Texte und Werkzeugaufrufe eines Subagenten in ihrer Reihenfolge, darunter Ergebnis oder Stand. */
export function SubagentTrail({ item }: SubagentTrailProps): ReactElement {
  const isRunning: boolean = item.state === 'running';
  const { scrollRef, handleScroll } = useStickToBottom(item.steps, isRunning);

  function renderStep(step: SubagentStep, index: number): ReactElement {
    if (step.text !== null) {
      return (
        <p key={index} className="background-detail__text">
          {step.text}
        </p>
      );
    }
    return (
      <div key={index} className="background-detail__step">
        ⎿ {step.tool}
        {'  '}
        {step.target}
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="background-detail__trail" onScroll={handleScroll}>
      {trailSteps(item).map(renderStep)}
      {showsResult(item) && (
        <>
          <h4 className="background-detail__result-label">Ergebnis</h4>
          <div className="background-detail__result">{item.result}</div>
        </>
      )}
      {isRunning && <p className="background-detail__hint">{RESULT_PENDING}</p>}
      {item.state === 'stopped' && <p className="background-detail__hint">{STOPPED_ON_REQUEST}</p>}
    </div>
  );
}
