import { useEffect, useState } from 'react';
import type { FileRef } from '@/lib/bindings/FileRef';
import { commandErrorText } from '@/lib/errors';
import { fileViewUrl } from '@/lib/sessionFiles';

export interface ViewerUrlState {
  url: string | null;
  error: string | null;
  isLoading: boolean;
}

interface Loaded {
  requestKey: string;
  url: string | null;
  error: string | null;
}

/** Holt die Betrachter-Adresse einer Datei. Die Adresse gilt nur bis zum Neustart der App und verfällt nach 512
 *  anderen Dateien, deshalb wird sie bei jedem Öffnen neu geholt und nie gespeichert. Zur selben Datei liefert der
 *  Core immer dieselbe Adresse; wer den Rahmen neu laden will, setzt einen neuen Schlüssel am `iframe`. */
export function useViewerUrl(sessionId: string, file: FileRef): ViewerUrlState {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const entryKey: string = file.kind === 'entry' ? file.key : '';
  const requestKey = `${sessionId}|${file.kind}|${entryKey}|${file.path}`;

  useEffect(() => {
    const controller = new AbortController();
    const ref: FileRef =
      file.kind === 'entry'
        ? { kind: 'entry', key: entryKey, path: file.path }
        : { kind: 'absolute', path: file.path };
    fileViewUrl(sessionId, ref)
      .then((url: string) => {
        if (!controller.signal.aborted) {
          setLoaded({ requestKey, url, error: null });
        }
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setLoaded({ requestKey, url: null, error: commandErrorText(reason) });
        }
      });
    return (): void => {
      controller.abort();
    };
  }, [sessionId, file.kind, file.path, entryKey, requestKey]);

  if (loaded === null || loaded.requestKey !== requestKey) {
    return { url: null, error: null, isLoading: true };
  }
  return { url: loaded.url, error: loaded.error, isLoading: false };
}
