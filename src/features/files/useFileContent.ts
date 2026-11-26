import { useEffect, useState } from 'react';
import type { FileContent } from '@/lib/bindings/FileContent';
import { commandErrorText } from '@/lib/errors';
import { readFile } from '@/lib/files';
import { readSessionFile } from '@/lib/sessionFiles';
import type { FileSource } from '@/stores/files';

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

/** Liest eine Datei je `<Session>|<Eintrag>|<Pfad>`, eine Session-Datei (`source: 'session'`, ohne Eintrag) über
 *  ihren absoluten Pfad. `changedAt` ist der Stempel der Datei in den Changes bzw. in der Liste: ändert er sich, lädt
 *  sie neu und der bisherige Inhalt bleibt bis zur Antwort stehen; ein neues Ergebnis mit gleichem Stempel liest
 *  nichts. Nur bei einer anderen Datei gilt sie als „lädt“. */
export function useFileContent(
  source: FileSource,
  sessionId: string,
  entryKey: string,
  path: string,
  changedAt: number,
): FileContentState {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const requestKey = `${source}|${sessionId}|${entryKey}|${path}`;

  useEffect(() => {
    const controller = new AbortController();
    const request: Promise<FileContent> =
      source === 'session' ? readSessionFile(sessionId, path) : readFile(sessionId, entryKey, path);
    request
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
  }, [source, sessionId, entryKey, path, requestKey, changedAt]);

  if (loaded === null || loaded.requestKey !== requestKey) {
    return { content: null, error: null, isLoading: true };
  }
  return { content: loaded.content, error: loaded.error, isLoading: false };
}
