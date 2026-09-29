import { useEffect, useRef, useState } from 'react';
import type { TextPreview } from '@/lib/bindings/TextPreview';
import { readScratchpadFile } from '@/lib/background';
import { commandErrorText } from '@/lib/errors';

export interface ScratchpadFileState {
  preview: TextPreview | null;
  error: string | null;
}

interface LoadedFile extends ScratchpadFileState {
  sessionId: string;
  path: string;
}

const NOTHING: ScratchpadFileState = { preview: null, error: null };

/** Textvorschau einer Scratchpad-Datei. `path` ist `null`, wenn nichts oder ein Bild gewählt ist (Bilder lädt
 *  das Asset-Protokoll). `modifiedMs` lädt die Vorschau neu, wenn der Agent die Datei ändert. */
export function useScratchpadFile(
  sessionId: string,
  path: string | null,
  modifiedMs: number | null,
): ScratchpadFileState {
  const [loaded, setLoaded] = useState<LoadedFile | null>(null);
  const requestRef = useRef<number>(0);

  useEffect(() => {
    if (path === null) {
      return undefined;
    }
    const currentPath: string = path;
    const controller = new AbortController();
    requestRef.current += 1;
    const request: number = requestRef.current;
    readScratchpadFile(sessionId, currentPath)
      .then((preview: TextPreview) => {
        if (!controller.signal.aborted && requestRef.current === request) {
          setLoaded({ sessionId, path: currentPath, preview, error: null });
        }
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted && requestRef.current === request) {
          setLoaded({
            sessionId,
            path: currentPath,
            preview: null,
            error: commandErrorText(reason),
          });
        }
      });
    return (): void => {
      controller.abort();
    };
  }, [sessionId, path, modifiedMs]);

  if (loaded === null || loaded.sessionId !== sessionId || loaded.path !== path) {
    return NOTHING;
  }
  return { preview: loaded.preview, error: loaded.error };
}
