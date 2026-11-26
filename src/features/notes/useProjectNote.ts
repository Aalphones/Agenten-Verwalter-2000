import { useCallback, useEffect, useRef, useState } from 'react';
import { commandErrorText } from '@/lib/errors';
import { readNote, writeNote } from '@/lib/notes';

const SAVE_DELAY_MS = 500;

export type NoteState = 'loading' | 'saved' | 'saving' | 'error';

interface ProjectNote {
  text: string;
  state: NoteState;
  error: string | null;
  setText: (text: string) => void;
  /** Speichert sofort, wenn etwas ungespeichert ist. */
  flush: () => void;
}

/** Lädt die Notiz eines Vorhabens und speichert Änderungen 500 ms nach dem letzten Tastendruck
 *  sowie beim Unmount. Die Kennung gilt für die ganze Lebenszeit des Aufrufers: bei einem
 *  Vorhabenwechsel muss er neu eingehängt werden (`key`), damit der alte Stand noch in sein
 *  Vorhaben geschrieben wird. */
export function useProjectNote(projectId: string): ProjectNote {
  const [text, setTextState] = useState<string>('');
  const [state, setState] = useState<NoteState>('loading');
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback((): void => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const flush = useCallback((): void => {
    clearTimer();
    const content: string | null = pendingRef.current;
    if (content === null) {
      return;
    }
    pendingRef.current = null;
    writeNote(projectId, content)
      .then(() => {
        if (pendingRef.current === null) {
          setState('saved');
          setError(null);
        }
      })
      .catch((reason: unknown) => {
        console.error('Notiz nicht gespeichert', reason);
        setState('error');
        setError(commandErrorText(reason));
      });
  }, [projectId, clearTimer]);

  useEffect(() => {
    let isCancelled = false;
    readNote(projectId)
      .then((note) => {
        if (isCancelled) {
          return;
        }
        setTextState(note.text);
        setState('saved');
      })
      .catch((reason: unknown) => {
        console.error('Notiz nicht gelesen', reason);
        if (!isCancelled) {
          setState('error');
          setError(commandErrorText(reason));
        }
      });
    return (): void => {
      isCancelled = true;
    };
  }, [projectId]);

  // Beim Verlassen (Reiterwechsel, Ausblenden, Vorhabenwechsel) geht der Rest sofort hinaus.
  useEffect(() => flush, [flush]);

  const setText = useCallback(
    (next: string): void => {
      setTextState(next);
      pendingRef.current = next;
      setState('saving');
      clearTimer();
      timerRef.current = window.setTimeout(flush, SAVE_DELAY_MS);
    },
    [clearTimer, flush],
  );

  return { text, state, error, setText, flush };
}
