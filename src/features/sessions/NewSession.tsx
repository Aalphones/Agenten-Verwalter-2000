import { useState } from 'react';
import type { ChangeEvent, KeyboardEvent, ReactElement, SubmitEvent } from 'react';
import { ModeMenu } from '@/components/ModeMenu';
import { ModelMenu } from '@/components/ModelMenu';
import { RepositoryPicker } from '@/features/repositories/RepositoryPicker';
import type { CommandError } from '@/lib/bindings/CommandError';
import type { Effort } from '@/lib/bindings/Effort';
import type { Mode } from '@/lib/bindings/Mode';
import type { ModelId } from '@/lib/bindings/ModelId';
import type { SessionSummary } from '@/lib/bindings/SessionSummary';
import { effortLabel, modeOption, modelName, repositoryCountLabel } from '@/lib/labels';
import { createSession } from '@/lib/sessions';
import './NewSession.css';

const CLAUDE_NOT_FOUND_MESSAGE =
  'Claude-Kommandozeile nicht gefunden. Installiere Claude Code oder setze VERWALTER_CLAUDE_PATH auf den Pfad zu claude.exe.';

const GIT_NOT_FOUND_MESSAGE =
  'Git nicht gefunden. Installiere Git für Windows und starte die App neu.';

type OpenMenu = 'model' | 'mode' | null;

interface NewSessionProps {
  onCreated: (summary: SessionSummary) => void;
  onCancel: () => void;
}

export function NewSession({ onCreated, onCancel }: NewSessionProps): ReactElement {
  const [text, setText] = useState<string>('');
  const [model, setModel] = useState<ModelId>('sonnet');
  const [effort, setEffort] = useState<Effort>('high');
  const [mode, setMode] = useState<Mode>('auto');
  const [repositoryIds, setRepositoryIds] = useState<string[]>([]);
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState<boolean>(false);

  const canStart: boolean = text.trim() !== '' && !isStarting;
  const currentMode = modeOption(mode);

  function closeMenu(): void {
    setOpenMenu(null);
  }

  function toggleMenu(menu: 'model' | 'mode'): void {
    setOpenMenu(openMenu === menu ? null : menu);
  }

  function start(): void {
    if (!canStart) {
      return;
    }
    setIsStarting(true);
    setErrorMessage(null);
    createSession(text.trim(), repositoryIds, model, effort, mode)
      .then((summary: SessionSummary) => {
        onCreated(summary);
      })
      .catch((reason: unknown) => {
        setErrorMessage(describeStartError(reason));
        setIsStarting(false);
      });
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    start();
  }

  function handleTextKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === 'Enter' && event.ctrlKey) {
      event.preventDefault();
      start();
    }
  }

  return (
    <div className="new-session">
      <header className="new-session__header">
        <h1 className="new-session__title">Neue Session</h1>
      </header>
      <form className="new-session__form" onSubmit={handleSubmit}>
        <section className="new-session__section">
          <label className="new-session__heading" htmlFor="new-session-task">
            <span className="new-session__step">1</span>
            Was soll erledigt werden?
          </label>
          <textarea
            id="new-session-task"
            className="new-session__task"
            rows={4}
            autoFocus
            placeholder="z. B. OAuth Login für Backend und Frontend implementieren. Den bestehenden Session-Mechanismus weiterverwenden."
            value={text}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>): void => {
              setText(event.target.value);
            }}
            onKeyDown={handleTextKeyDown}
          />
          <p className="new-session__note">
            Der erste Satz wird zum Namen der Session, der ganze Text zur ersten Nachricht an den
            Agenten.
          </p>
        </section>
        <RepositoryPicker selectedIds={repositoryIds} onChange={setRepositoryIds} />
        <section className="new-session__section">
          <div className="new-session__heading">
            <span className="new-session__step">3</span>
            Agent
          </div>
          <div className="new-session__pickers">
            <div className="new-session__anchor">
              <button
                type="button"
                className="new-session__model"
                aria-haspopup="dialog"
                aria-expanded={openMenu === 'model'}
                aria-label={`Modell: ${modelName(model)}, Denkaufwand ${effortLabel(effort)}`}
                onClick={(): void => {
                  toggleMenu('model');
                }}
              >
                Claude · {modelName(model)}{' '}
                <span className="new-session__effort">{effortLabel(effort)}</span>
              </button>
              {openMenu === 'model' && (
                <ModelMenu
                  value={model}
                  onChange={setModel}
                  onClose={closeMenu}
                  placement="below"
                  note="Gilt für den Start dieser Session. Später im Chat änderbar."
                />
              )}
            </div>
            <div className="new-session__anchor">
              <button
                type="button"
                className="new-session__mode"
                aria-haspopup="dialog"
                aria-expanded={openMenu === 'mode'}
                aria-label={`Modus: ${currentMode.label}`}
                onClick={(): void => {
                  toggleMenu('mode');
                }}
              >
                <span className="new-session__mode-icon">{currentMode.icon}</span>
                {currentMode.label}
              </button>
              {openMenu === 'mode' && (
                <ModeMenu
                  mode={mode}
                  effort={effort}
                  onModeChange={setMode}
                  onEffortChange={setEffort}
                  onClose={closeMenu}
                  placement="below"
                />
              )}
            </div>
          </div>
        </section>
        <div className="new-session__footer">
          <button type="submit" className="new-session__start" disabled={!canStart}>
            Session starten
          </button>
          <button type="button" className="new-session__cancel" onClick={onCancel}>
            Abbrechen
          </button>
          <span className="new-session__summary">
            {isStarting && repositoryIds.length > 0
              ? 'Worktrees werden angelegt …'
              : `${repositoryCountLabel(repositoryIds.length)} · ${modelName(model)} · ${currentMode.label}`}
          </span>
        </div>
        {errorMessage !== null && (
          <p className="new-session__error" role="alert">
            {errorMessage}
          </p>
        )}
      </form>
    </div>
  );
}

function isCommandError(reason: unknown): reason is CommandError {
  return typeof reason === 'object' && reason !== null && 'kind' in reason;
}

function describeStartError(reason: unknown): string {
  if (isCommandError(reason)) {
    switch (reason.kind) {
      case 'claudeNotFound':
        return CLAUDE_NOT_FOUND_MESSAGE;
      case 'gitNotFound':
        return GIT_NOT_FOUND_MESSAGE;
      case 'repositoryMissing':
        return `Repository nicht gefunden: ${reason.message}. Entferne es aus der Liste oder stelle den Ordner wieder her.`;
      case 'git':
        return `Worktree konnte nicht angelegt werden — ${reason.message}`;
      default:
        break;
    }
  }
  if (typeof reason === 'object' && reason !== null && 'message' in reason) {
    return `Session konnte nicht starten: ${String(reason.message)}`;
  }
  return `Session konnte nicht starten: ${String(reason)}`;
}
