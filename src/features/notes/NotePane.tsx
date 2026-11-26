import { useEffect, useState } from 'react';
import type { KeyboardEvent, ReactElement, SyntheticEvent } from 'react';
import { lineToSend } from '@/features/notes/lineToSend';
import type { LineToSend } from '@/features/notes/lineToSend';
import { useSendTarget } from '@/features/notes/useSendTarget';
import { focusTerminal } from '@/features/terminal/terminalInstances';
import type { TerminalInfo } from '@/lib/bindings/TerminalInfo';
import { commandErrorText } from '@/lib/errors';
import { writeTerminal } from '@/lib/terminal';
import { useTerminalStore } from '@/stores/terminal';
import { useProjectNote } from '@/features/notes/useProjectNote';
import type { NoteState } from '@/features/notes/useProjectNote';
import './NotePane.css';

const PLACEHOLDER =
  'Befehle zusammenbauen, Token ergänzen … — wird automatisch gespeichert, Agenten sehen diese Notiz nicht.';

interface NotePaneProps {
  projectId: string;
  /** Meldet den Fehlersatz der Notiz an die Fehlerzeile des Anzeigeorts. */
  onError?: (message: string | null) => void;
}

function statusText(state: NoteState): string {
  if (state === 'saving') {
    return 'Speichert …';
  }
  if (state === 'saved') {
    return 'Gespeichert';
  }
  return '';
}

interface SendState {
  isDisabled: boolean;
  title: string;
}

function sendState(target: TerminalInfo | null, choice: LineToSend): SendState {
  if (target === null) {
    return { isDisabled: true, title: 'Kein laufendes Terminal — im Dock mit + eines starten' };
  }
  if (choice.kind === 'multiline') {
    return {
      isDisabled: true,
      title: 'Nur eine Zeile — mehrere Zeilen würden einzeln ausgeführt',
    };
  }
  if (choice.kind === 'empty') {
    return { isDisabled: true, title: 'Leere Zeile' };
  }
  return {
    isDisabled: false,
    title: `Markierte Zeile bzw. Zeile unter dem Cursor ins Terminal schreiben, ohne Enter (Strg+Enter) — in Terminal ${String(target.number)}`,
  };
}

export function NotePane({ projectId, onError }: NotePaneProps): ReactElement {
  const { text, state, error, setText, flush } = useProjectNote(projectId);

  const [selection, setSelection] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
  const [sendError, setSendError] = useState<string | null>(null);
  const target: TerminalInfo | null = useSendTarget(projectId);
  const isDockOpen: boolean = useTerminalStore((state) => state.isOpen);
  const toggleDock = useTerminalStore((state) => state.toggle);
  const select = useTerminalStore((state) => state.select);
  const choice: LineToSend = lineToSend(
    text,
    Math.min(selection.start, text.length),
    Math.min(selection.end, text.length),
  );
  const send: SendState = sendState(target, choice);
  const shownError: string | null = sendError ?? error;

  function rememberSelection(event: SyntheticEvent<HTMLTextAreaElement>): void {
    const { selectionStart, selectionEnd } = event.currentTarget;
    setSelection({ start: selectionStart, end: selectionEnd });
  }

  function sendToTerminal(): void {
    if (send.isDisabled || target === null || choice.kind !== 'ok') {
      return;
    }
    const terminalId: string = target.id;
    flush();
    writeTerminal(terminalId, choice.line)
      .then(() => {
        setSendError(null);
        select(projectId, terminalId);
        if (!isDockOpen) {
          toggleDock();
        }
        // Zeigt das Dock das Ziel schon, hängt `show` es nicht neu ein und setzt den Fokus nicht.
        window.requestAnimationFrame(() => {
          focusTerminal(terminalId);
        });
      })
      .catch((reason: unknown) => {
        console.error('Zeile nicht ins Terminal geschrieben', reason);
        setSendError(commandErrorText(reason));
      });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === 'Enter' && event.ctrlKey && !event.altKey && !event.shiftKey) {
      event.preventDefault();
      event.stopPropagation();
      sendToTerminal();
    }
  }

  useEffect(() => {
    onError?.(shownError);
    return (): void => {
      onError?.(null);
    };
  }, [shownError, onError]);

  return (
    <div className="note-pane">
      <div className="note-pane__bar">
        <div className="note-pane__tools">
          <button
            type="button"
            className="note-pane__send"
            disabled={send.isDisabled}
            title={send.title}
            onClick={sendToTerminal}
          >
            Ins Terminal
          </button>
        </div>
        <span className="note-pane__status" role="status">
          {statusText(state)}
        </span>
      </div>
      <textarea
        className="note-pane__text"
        value={text}
        placeholder={PLACEHOLDER}
        wrap="off"
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        disabled={state === 'loading'}
        aria-label="Notiz"
        onChange={(event): void => {
          setText(event.target.value);
        }}
        onSelect={rememberSelection}
        onKeyDown={handleKeyDown}
        onBlur={flush}
      />
    </div>
  );
}
