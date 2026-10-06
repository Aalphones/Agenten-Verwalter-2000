import { useState } from 'react';
import type { ReactElement } from 'react';
import { COMPOSER_INPUT_ID } from '@/features/background/mention';
import { modelOfHandoff } from '@/features/chat/handoff';
import type { ModelId } from '@/lib/bindings/ModelId';
import type { SessionSummary } from '@/lib/bindings/SessionSummary';
import { commandErrorText } from '@/lib/errors';
import { createSessionInProject, setSessionModel } from '@/lib/sessions';
import { useChatStore } from '@/stores/chat';
import './HandoffButton.css';

const HANDOFF_TITLE =
  'Legt im Vorhaben eine neue Session an – Modell, Modus und Repositories wie bisher – und setzt diese Zeile in ihr Eingabefeld. Gesendet wird erst, wenn du auf Senden klickst.';

interface HandoffButtonProps {
  projectId: string;
  /** Die Einstiegszeile, die in den Entwurf der neuen Session kommt. */
  line: string;
  /** Nimmt die angelegte Session in die Liste und wählt sie aus (`handleSessionCreated` in `App`). */
  onSessionCreated: (created: SessionSummary) => void;
}

/** Leerer Entwurf → die Zeile; enthält er sie schon → unverändert; sonst Zeile, Leerzeile, alter Entwurf. */
function setHandoffDraft(sessionId: string, line: string): void {
  const current: string = useChatStore.getState().drafts[sessionId] ?? '';
  if (current.includes(line)) {
    return;
  }
  const draft: string = current === '' ? line : `${line}\n\n${current}`;
  useChatStore.getState().setDraft(sessionId, draft);
}

function focusComposer(): void {
  // Die neue Session wird gerade erst ausgewählt — das Textfeld gibt es erst im nächsten Frame.
  window.requestAnimationFrame(() => {
    document.getElementById(COMPOSER_INPUT_ID)?.focus();
  });
}

export function HandoffButton({
  projectId,
  line,
  onSessionCreated,
}: HandoffButtonProps): ReactElement {
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function continueInNewSession(): Promise<void> {
    setIsCreating(true);
    setErrorMessage(null);
    let created: SessionSummary;
    try {
      created = await createSessionInProject(projectId);
    } catch (reason: unknown) {
      setErrorMessage(commandErrorText(reason));
      setIsCreating(false);
      return;
    }
    onSessionCreated(created);
    const model: ModelId | null = modelOfHandoff(line);
    if (model !== null && model !== created.model) {
      try {
        await setSessionModel(created.id, model);
      } catch (reason: unknown) {
        setErrorMessage(`Modell nicht umgestellt: ${commandErrorText(reason)}`);
      }
    }
    setHandoffDraft(created.id, line);
    focusComposer();
    setIsCreating(false);
  }

  return (
    <div className="handoff">
      <button
        type="button"
        className="handoff__button"
        title={HANDOFF_TITLE}
        disabled={isCreating}
        onClick={(): void => {
          void continueInNewSession();
        }}
      >
        {isCreating ? 'Lege Session an …' : 'In neuer Session weiter'}
      </button>
      {errorMessage !== null && (
        <p className="handoff__error" role="alert">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
