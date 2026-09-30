import { useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent, ReactElement } from 'react';
import { ModeMenu } from '@/components/ModeMenu';
import { ModelMenu } from '@/components/ModelMenu';
import { AttachMenu } from '@/features/attachments/AttachMenu';
import { AttachmentRow } from '@/features/attachments/AttachmentRow';
import { useAttachmentInput } from '@/features/attachments/useAttachmentInput';
import { CommandMenu } from '@/features/chat/CommandMenu';
import { applySkillToDraft } from '@/features/chat/commandMenuRows';
import type { CommandRow, SessionCommand } from '@/features/chat/commandMenuRows';
import { useCommandMenu } from '@/features/chat/useCommandMenu';
import type { Attachment } from '@/lib/bindings/Attachment';
import type { CommandError } from '@/lib/bindings/CommandError';
import type { Effort } from '@/lib/bindings/Effort';
import type { Mode } from '@/lib/bindings/Mode';
import type { ModelId } from '@/lib/bindings/ModelId';
import type { SessionStatus } from '@/lib/bindings/SessionStatus';
import type { SessionSummary } from '@/lib/bindings/SessionSummary';
import { sendMessage } from '@/lib/chat';
import { MODE_OPTIONS, effortLabel, modeOption, modelName } from '@/lib/labels';
import type { ModeOption } from '@/lib/labels';
import { pauseSession, setSessionEffort, setSessionMode, setSessionModel } from '@/lib/sessions';
import { useAttachmentsStore } from '@/stores/attachments';
import { useChatStore } from '@/stores/chat';
import { useSessionsStore } from '@/stores/sessions';
import './Composer.css';

const NOTE_WHILE_ACTIVE =
  'Gilt ab der nächsten Nachricht an den Agenten. Der bisherige Verlauf bleibt erhalten.';
const NOTE_WHILE_IDLE = 'Gilt ab der nächsten Nachricht in dieser Session.';
const ATTACH_TITLE = 'Bilder und Dateien hinzufügen';
const ATTACH_TITLE_WHILE_WAITING = 'Anhänge gehen erst, wenn die Rückfrage beantwortet ist';

const ACTIVE_STATUSES: readonly SessionStatus[] = ['starting', 'running', 'waiting'];
const NO_ATTACHMENTS: Attachment[] = [];

type OpenMenu = 'model' | 'mode' | 'plus' | 'command' | null;

interface ComposerProps {
  session: SessionSummary;
}

export function Composer({ session }: ComposerProps): ReactElement {
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSending, setIsSending] = useState<boolean>(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const draft: string = useChatStore((state) => state.drafts[session.id] ?? '');
  const setDraft = useChatStore((state) => state.setDraft);
  const clearDraft = useChatStore((state) => state.clearDraft);
  const pending: Attachment[] = useAttachmentsStore(
    (state) => state.pending[session.id] ?? NO_ATTACHMENTS,
  );
  const removeAttachment = useAttachmentsStore((state) => state.remove);
  const showView = useSessionsStore((state) => state.showView);
  const startRename = useSessionsStore((state) => state.startRename);

  const isLocked: boolean = session.status === 'cancelled' || session.status === 'error';
  const isWaiting: boolean = session.status === 'waiting';
  const canSend: boolean = (draft.trim() !== '' || pending.length > 0) && !isSending && !isLocked;
  const currentMode = modeOption(session.mode);
  const modelNote: string = ACTIVE_STATUSES.includes(session.status)
    ? NOTE_WHILE_ACTIVE
    : NOTE_WHILE_IDLE;

  const { openPicker, handlePaste, isDragging } = useAttachmentInput({
    key: session.id,
    enabled: !isLocked && !isWaiting,
    onError: setErrorMessage,
  });
  const commandMenu = useCommandMenu({
    draft,
    isButtonOpen: openMenu === 'command',
    isSuppressed: isLocked || openMenu !== null,
    buttonScope: 'full',
    slashScope: 'slash',
    skillSource: { sessionId: session.id },
    session,
  });

  function closeMenu(): void {
    setOpenMenu(null);
  }

  function toggleMenu(menu: 'model' | 'mode' | 'plus' | 'command'): void {
    if (menu === 'command' && openMenu !== 'command') {
      commandMenu.resetFilter();
    }
    setOpenMenu(openMenu === menu ? null : menu);
  }

  function closeCommandMenu(): void {
    if (openMenu === 'command') {
      setOpenMenu(null);
    }
    commandMenu.dismissSlash();
  }

  function report(reason: unknown): void {
    setErrorMessage(describeError(reason));
  }

  function send(): void {
    if (!canSend) {
      return;
    }
    const text: string = draft.trim();
    const attachmentIds: string[] = pending.map((attachment: Attachment) => attachment.id);
    setIsSending(true);
    setErrorMessage(null);
    sendMessage(session.id, text, attachmentIds)
      .then(() => {
        useAttachmentsStore.getState().clearIds(session.id, attachmentIds);
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

  function runSessionCommand(command: SessionCommand): void {
    if (command === 'rename') {
      startRename('session', session.id);
    } else if (command === 'changes') {
      showView('changes');
    } else {
      setErrorMessage(null);
      pauseSession(session.id).catch(report);
    }
  }

  function pickRow(row: CommandRow): void {
    const wasSlashMenu: boolean = commandMenu.isSlashOpen;
    closeCommandMenu();
    if (row.kind === 'attach') {
      openPicker();
    } else if (row.kind === 'model') {
      setOpenMenu('model');
    } else if (row.kind === 'skill') {
      setDraft(session.id, applySkillToDraft(draft, row.skill.name));
      inputRef.current?.focus();
    } else if (row.kind === 'session') {
      if (wasSlashMenu) {
        clearDraft(session.id);
      }
      runSessionCommand(row.command);
    }
  }

  function pickFromPlusMenu(): void {
    closeMenu();
    openPicker();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (commandMenu.handleSlashKeyDown(event, pickRow)) {
      return;
    }
    // Enter sendet, Umschalt+Enter bleibt der Zeilenumbruch des Textfelds; Enter während einer IME-Eingabe gehört der IME.
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send();
      return;
    }
    if (event.key.toLowerCase() === 'u' && event.ctrlKey) {
      event.preventDefault();
      openPicker();
      return;
    }
    if (event.key === 'Tab' && event.shiftKey) {
      event.preventDefault();
      cycleMode();
    }
  }

  const boxClass = `composer__box${isDragging ? ' composer__box--dragging' : ''}`;

  return (
    <div className="composer">
      <div className={boxClass}>
        {pending.length > 0 && (
          <AttachmentRow
            attachments={pending}
            size="input"
            onRemove={(attachmentId: string): void => {
              removeAttachment(session.id, attachmentId);
            }}
          />
        )}
        <label className="composer__label" htmlFor="composer-input">
          Nachricht an den Agenten
        </label>
        <textarea
          id="composer-input"
          ref={inputRef}
          className="composer__input"
          rows={2}
          disabled={isLocked}
          placeholder={placeholderFor(session.status)}
          value={draft}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>): void => {
            setDraft(session.id, event.target.value);
          }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
        />
        <div className="composer__bar">
          <div className="composer__anchor">
            <button
              type="button"
              className="composer__icon-button"
              aria-haspopup="dialog"
              aria-expanded={openMenu === 'plus'}
              aria-label={ATTACH_TITLE}
              title={isWaiting ? ATTACH_TITLE_WHILE_WAITING : ATTACH_TITLE}
              disabled={isLocked || isWaiting}
              onClick={(): void => {
                toggleMenu('plus');
              }}
            >
              <PlusIcon />
            </button>
            {openMenu === 'plus' && <AttachMenu onPick={pickFromPlusMenu} onClose={closeMenu} />}
          </div>
          <button
            type="button"
            className="composer__icon-button"
            aria-haspopup="dialog"
            aria-expanded={openMenu === 'command'}
            aria-label="Befehle und Skills"
            title="Befehle und Skills – oder / ins Feld tippen"
            disabled={isLocked}
            onClick={(): void => {
              toggleMenu('command');
            }}
          >
            <SlashIcon />
          </button>
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
            aria-label="Senden (Enter)"
            title="Senden (Enter) – Umschalt+Enter für einen Zeilenumbruch"
            disabled={!canSend}
            onClick={send}
          >
            <SendArrow />
          </button>
        </div>
        {commandMenu.isOpen && (
          <CommandMenu
            sections={commandMenu.sections}
            highlighted={commandMenu.highlighted}
            onHighlight={commandMenu.setHighlighted}
            onPick={pickRow}
            showFilter={commandMenu.showFilter}
            filter={commandMenu.filter}
            onFilterChange={commandMenu.setFilter}
            onNavigationKey={(event: KeyboardEvent<HTMLElement>): boolean =>
              commandMenu.handleNavigationKey(event, pickRow)
            }
            onClose={closeCommandMenu}
            session={session}
            onEffortChange={changeEffort}
            isSkillsOnly={false}
          />
        )}
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
  if (status === 'new') {
    return 'Erste Nachricht an Claude … (/ für Skills)';
  }
  if (status === 'cancelled') {
    return 'Session abgebrochen – leg eine neue Session an.';
  }
  if (status === 'error') {
    return 'Agent beendet – starte ihn im Chat neu.';
  }
  return 'Nachricht an Claude … (/ für Skills)';
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
    if (reason.kind === 'attachmentsWhileWaiting') {
      return 'Anhänge gehen erst, wenn die Rückfrage beantwortet ist.';
    }
    if ('message' in reason) {
      return `Aktion fehlgeschlagen: ${reason.message}`;
    }
  }
  return `Aktion fehlgeschlagen: ${String(reason)}`;
}

function PlusIcon(): ReactElement {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M7 2v10M2 7h10" />
    </svg>
  );
}

function SlashIcon(): ReactElement {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <rect x="1.5" y="1.5" width="11" height="11" rx="2" />
      <path d="M8.6 4 5.4 10" />
    </svg>
  );
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
