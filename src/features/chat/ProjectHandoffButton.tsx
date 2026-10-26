import { useState } from 'react';
import type { ReactElement } from 'react';
import { matchingRepositoryIds, taskOfProjectLine } from '@/features/chat/handoff';
import type { HandoffLine } from '@/lib/bindings/HandoffLine';
import { listRepositories } from '@/lib/repositories';
import { useSessionsStore } from '@/stores/sessions';
import './HandoffButton.css';

const PROJECT_HANDOFF_TITLE =
  'Öffnet „Neues Vorhaben“ mit dieser Zeile als Auftrag, dem Modell aus der Zeile und den Repositories, deren Name in der Zeile steht. Gestartet wird erst mit „Starten“.';

interface ProjectHandoffButtonProps {
  /** Die Zeile „Neues Vorhaben … : …“, aus der der Dialog vorbelegt wird. */
  line: HandoffLine;
}

export function ProjectHandoffButton({ line }: ProjectHandoffButtonProps): ReactElement {
  const [isOpening, setIsOpening] = useState<boolean>(false);

  async function openPrefilledDialog(): Promise<void> {
    setIsOpening(true);
    let repositoryIds: string[] = [];
    try {
      repositoryIds = matchingRepositoryIds(line.text, await listRepositories());
    } catch (reason: unknown) {
      console.error('Repositories für die Vorbelegung nicht ladbar', reason);
    }
    useSessionsStore.getState().openNewSessionWith({
      task: taskOfProjectLine(line.text),
      model: line.model,
      repositoryIds,
    });
    setIsOpening(false);
  }

  return (
    <div className="handoff">
      <button
        type="button"
        className="handoff__button"
        title={PROJECT_HANDOFF_TITLE}
        disabled={isOpening}
        onClick={(): void => {
          void openPrefilledDialog();
        }}
      >
        {isOpening ? 'Öffne …' : 'In neuem Vorhaben starten'}
      </button>
    </div>
  );
}
