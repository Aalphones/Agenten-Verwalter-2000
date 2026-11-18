import { useEffect, useState } from 'react';
import type { FileDiff } from '@/lib/bindings/FileDiff';
import { commandErrorText } from '@/lib/errors';
import { loadCommitDiff } from '@/lib/files';

export interface CommitDiffState {
  diff: FileDiff | null;
  error: string | null;
  isLoading: boolean;
}

interface Loaded {
  requestKey: string;
  diff: FileDiff | null;
  error: string | null;
}

/** Der Diff eines Schritts (eines eigenen Commits) an einer Datei. */
export function useCommitDiff(
  sessionId: string,
  entryKey: string,
  commit: string,
  path: string,
): CommitDiffState {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const requestKey = `${sessionId}|${entryKey}|${commit}|${path}`;

  useEffect(() => {
    const controller = new AbortController();
    loadCommitDiff(sessionId, entryKey, commit, path)
      .then((diff: FileDiff) => {
        if (!controller.signal.aborted) {
          setLoaded({ requestKey, diff, error: null });
        }
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setLoaded({ requestKey, diff: null, error: commandErrorText(reason) });
        }
      });
    return (): void => {
      controller.abort();
    };
  }, [sessionId, entryKey, commit, path, requestKey]);

  if (loaded === null || loaded.requestKey !== requestKey) {
    return { diff: null, error: null, isLoading: true };
  }
  return { diff: loaded.diff, error: loaded.error, isLoading: false };
}
