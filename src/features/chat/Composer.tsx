import { useState } from 'react';
import type { ChangeEvent, KeyboardEvent, ReactElement } from 'react';
import { ModeMenu } from '@/components/ModeMenu';
import { ModelMenu } from '@/components/ModelMenu';
import type { CommandError } from '@/lib/bindings/CommandError';
import type { Effort } from '@/lib/bindings/Effort';
import type { Mode } from '@/lib/bindings/Mode';
import type { ModelId } from '@/lib/bindings/ModelId';
import type { SessionStatus } from '@/lib/bindings/SessionStatus';
import type { SessionSummary } from '@/lib/bindings/SessionSummary';
import { sendMessage } from '@/lib/chat';
import { MODE_OPTIONS, effortLabel, modeOption, modelName } from '@/lib/labels';
import type { ModeOption } from '@/lib/labels';
import { setSessionEffort, setSessionMode, setSessionModel } from '@/lib/sessions';
import { useChatStore } from '@/stores/chat';
import './Composer.css';

const NOTE_WHILE_ACTIVE =
  'Gilt ab der nächsten Nachricht an den Agenten. Der bisherige Verlauf bleibt erhalten.';
const NOTE_WHILE_IDLE = 'Gilt ab der nächsten Nachricht in dieser Session.';

const ACTIVE_STATUSES: readonly SessionStatus[] = ['starting', 'running', 'waiting'];

type OpenMenu = 'model' | 'mode' | null;

interface ComposerProps {
  session: SessionSummary;
}

export function Composer({ session }: ComposerProps): ReactElement {
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSending, setIsSending] = useState<boolean>(false);
  const draft: string = useChatStore((state) => state.drafts[session.id] ?? '');
  const setDraft = useChatStore((state) => state.setDraft);
  const clearDraft = useChatStore((state) => state.clearDraft);

  const isLocked: boolean = session.status === 'cancelled' || session.status === 'error';
  const canSend: boolean = draft.trim() !== '' && !isSending && !isLocked;
  const currentMode = modeOption(session.mode);
  const modelNote: string = ACTIVE_STATUSES.includes(session.status)
    ? NOTE_WHILE_ACTIVE
    : NOTE_WHILE_IDLE;

  function closeMenu(): void {
    setOpenMenu(null);
  }

  function toggleMenu(menu: 'model' | 'mode'): void {
    setOpenMenu(openMenu === menu ? null : menu);
  }

  function report(reason: unknown): void {
    setErrorMessage(describeError(reason));
  }

  function send(): void {
    if (!canSend) {
      return;
    }
    const text: string = draft.trim();
    setIsSending(true);
    setErrorMessage(null);
    sendMessage(session.id, text, [])
      .then(() => {
        // Wurde während des Sendens weitergetippt, bleibt der neuere Text erhalten.
        if ((useChatStore.getState().drafts[session.id] ?? '') === draft) {
          clearDraft(session.id);
        }
      })
      .catch(report)
      .finally(() => {
        setIsSending(false);
      });
  }

  function changeModel(model: ModelId): void {
    closeMenu();
    setErrorMessage(null);
    setSessionModel(session.id, model).catch(report);
  }

  function changeMode(mode: Mode): void {
    closeMenu();
    setErrorMessage(null);
    setSessionMode(session.id, mode).catch(report);
  }

  function changeEffort(effort: Effort): void {
    setErrorMessage(null);
    setSessionEffort(session.id, effort).catch(report);
  }

  function cycleMode(): void {
    const currentIndex: number = MODE_OPTIONS.findIndex(
      (option: ModeOption) => option.id === session.mode,
    );
    const next: ModeOption | undefined = MODE_OPTIONS[(currentIndex + 1) % MODE_OPTIONS.length];
    if (next !== undefined) {
      changeMode(next.id);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === 'Enter' && event.ctrlKey) {
      event.preventDefault();
      send();
      return;
    }
    if (event.key === 'Tab' && event.shiftKey) {
      event.preventDefault();
      cycleMode();
    }
  }

  return (
    <div className="composer">
      <div className="composer__box">
        <label className="composer__label" htmlFor="composer-input">
          Nachricht an den Agenten
        </label>
        <textarea
          id="composer-input"
          className="composer__input"
          rows={2}
          disabled={isLocked}
          placeholder={placeholderFor(session.status)}
          value={draft}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>): void => {
            setDraft(session.id, event.target.value);
          }}
          onKeyDown={handleKeyDown}
        />
        <div className="composer__bar">
          <div className="composer__anchor">
            <button
              type="button"
              className="composer__model"
              aria-haspopup="dialog"
              aria-expanded={openMenu === 'model'}
              aria-label={`Modell: ${modelName(session.model)}, Denkaufwand ${effortLabel(session.effort)}`}
              onClick={(): void => {
                toggleMenu('model');
              }}
            >
              <span>{modelName(session.model)}</span>
              <span className="composer__effort">{effortLabel(session.effort)}</span>
            </button>
            {openMenu === 'model' && (
              <ModelMenu
                value={session.model}
                onChange={changeModel}
                onClose={closeMenu}
                placement="above"
                note={modelNote}
              />
            )}
          </div>
          <div className="composer__anchor composer__anchor--end">
            <button
              type="button"
              className="composer__mode"
              aria-haspopup="dialog"
              aria-expanded={openMenu === 'mode'}
              aria-label={`Modus: ${currentMode.label}`}
              onClick={(): void => {
                toggleMenu('mode');
              }}
            >
              <span className="composer__mode-icon">{currentMode.icon}</span>
              <span>{currentMode.label}</span>
            </button>
            {openMenu === 'mode' && (
              <ModeMenu
                mode={session.mode}
                effort={session.effort}
                onModeChange={changeMode}
                onEffortChange={changeEffort}
                onClose={closeMenu}
                placement="above"
              />
            )}
          </div>
          <button
            type="button"
            className="composer__send"
            aria-label="Senden (Ctrl+Enter)"
            title="Senden (Ctrl+Enter)"
            disabled={!canSend}
            onClick={send}
          >
            <SendArrow />
          </button>
        </div>
      </div>
      {errorMessage !== null && (
        <p className="composer__error" role="alert">
          {errorMessage}
        </p>
      )}
    </div>
  );
}

function placeholderFor(status: SessionStatus): string {
  if (status === 'waiting') {
    return 'Antwort an Claude …';
  }
  if (status === 'cancelled') {
    return 'Session abgebrochen – leg eine neue Session an.';
  }
  if (status === 'error') {
    return 'Agent beendet – starte ihn im Chat neu.';
  }
  return 'Nachricht an Claude …';
}

function isCommandError(reason: unknown): reason is CommandError {
  return typeof reason === 'object' && reason !== null && 'kind' in reason;
}

function describeError(reason: unknown): string {
  if (isCommandError(reason)) {
    if (reason.kind === 'sessionClosed') {
      return 'Die Session ist abgebrochen und nimmt keine Nachrichten mehr an.';
    }
    if (reason.kind === 'agentStopped') {
      return 'Der Agent läuft nicht mehr. Starte ihn im Chat neu.';
    }
    if (reason.kind === 'claudeNotFound') {
      return 'Claude-Kommandozeile nicht gefunden.';
    }
    if ('message' in reason) {
      return `Aktion fehlgeschlagen: ${reason.message}`;
    }
  }
  return `Aktion fehlgeschlagen: ${String(reason)}`;
}

function SendArrow(): ReactElement {
  return (
    <svg width="15" height="15" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M7 12V2.5M3 6.5 7 2.5l4 4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
