import { useEffect, useState } from 'react';
import type { FileContent } from '@/lib/bindings/FileContent';
import { commandErrorText } from '@/lib/errors';
import { readFile } from '@/lib/files';

export interface FileContentState {
  content: FileContent | null;
  error: string | null;
  isLoading: boolean;
}

interface Loaded {
  requestKey: string;
  content: FileContent | null;
  error: string | null;
}

/** Liest eine Datei je `<Session>|<Eintrag>|<Pfad>`. `changedAt` ist der Stempel der Datei in den Changes: ändert er
 *  sich, lädt sie neu und der bisherige Inhalt bleibt bis zur Antwort stehen; ein neues Ergebnis der Changes mit
 *  gleichem Stempel liest nichts. Nur bei einer anderen Datei gilt sie als „lädt“. */
export function useFileContent(
  sessionId: string,
  entryKey: string,
  path: string,
  changedAt: number,
): FileContentState {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const requestKey = `${sessionId}|${entryKey}|${path}`;

  useEffect(() => {
    const controller = new AbortController();
    readFile(sessionId, entryKey, path)
      .then((content: FileContent) => {
        if (!controller.signal.aborted) {
          setLoaded({ requestKey, content, error: null });
        }
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setLoaded({ requestKey, content: null, error: commandErrorText(reason) });
        }
      });
    return (): void => {
      controller.abort();
    };
    // `changedAt` löst das Nachladen aus, ohne im Effekt gelesen zu werden.
  }, [sessionId, entryKey, path, requestKey, changedAt]);

  if (loaded === null || loaded.requestKey !== requestKey) {
    return { content: null, error: null, isLoading: true };
  }
  return { content: loaded.content, error: loaded.error, isLoading: false };
}
