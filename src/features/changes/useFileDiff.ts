import { useEffect, useState } from 'react';
import type { ChangeScope } from '@/lib/bindings/ChangeScope';
import type { ChangesReach } from '@/lib/bindings/ChangesReach';
import type { FileDiff } from '@/lib/bindings/FileDiff';
import { loadFileDiff } from '@/lib/changes';
import { commandErrorText } from '@/lib/errors';
import type { OpenFile } from '@/stores/changes';

export interface FileDiffState {
  diff: FileDiff | null;
  error: string | null;
  isLoading: boolean;
}

interface LoadedDiff {
  key: string;
  diff: FileDiff | null;
  error: string | null;
}

export function fileDiffKey(file: OpenFile, scope: ChangeScope): string {
  return `${file.key}:${file.path}:${scope}`;
}

/** Lädt den Diff der geöffneten Datei. `stamp` fasst die Zahlen der Datei zusammen: ändern sie sich, lädt der Diff
 *  neu, der bisherige bleibt bis dahin stehen. Nur bei einer anderen Datei oder einem anderen Blickwinkel gilt er
 *  als „lädt“. */
export function useFileDiff(
  sessionId: string,
  reach: ChangesReach,
  file: OpenFile,
  scope: ChangeScope,
  stamp: string,
): FileDiffState {
  const [state, setState] = useState<LoadedDiff | null>(null);
  const diffKey: string = fileDiffKey(file, scope);
  const { key, path } = file;

  useEffect(() => {
    const controller = new AbortController();
    loadFileDiff(sessionId, reach, key, path, scope)
      .then((diff: FileDiff) => {
        if (!controller.signal.aborted) {
          setState({ key: diffKey, diff, error: null });
        }
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setState({ key: diffKey, diff: null, error: commandErrorText(reason) });
        }
      });
    return (): void => {
      controller.abort();
    };
    // `stamp` löst das Nachladen aus, ohne im Effekt gelesen zu werden.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, reach, diffKey, stamp]);

  if (state === null || state.key !== diffKey) {
    return { diff: null, error: null, isLoading: true };
  }
  return { diff: state.diff, error: state.error, isLoading: false };
}
