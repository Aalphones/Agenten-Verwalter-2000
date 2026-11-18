import { useCallback, useEffect, useRef, useState } from 'react';
import { ignoredKey, type LoadState } from '@/features/files/buildTreeRows';
import type { DirEntry } from '@/lib/bindings/DirEntry';
import type { RepoTree } from '@/lib/bindings/RepoTree';
import { commandErrorText } from '@/lib/errors';
import { loadIgnoredChildren, loadRepoTree } from '@/lib/files';

export interface RepoTreesState {
  /** Je Anker-Schlüssel. */
  trees: ReadonlyMap<string, LoadState<RepoTree>>;
  /** Je `<Anker>|<Pfad>`. */
  ignoredChildren: ReadonlyMap<string, LoadState<DirEntry[]>>;
  /** Liest die Kinder eines ignorierten Ordners, falls noch nicht geschehen. */
  loadIgnored: (entryKey: string, path: string) => void;
}

const NO_TREES: ReadonlyMap<string, LoadState<RepoTree>> = new Map();
const NO_CHILDREN: ReadonlyMap<string, LoadState<DirEntry[]>> = new Map();

function withEntry<T>(map: ReadonlyMap<string, T>, key: string, value: T): Map<string, T> {
  const next = new Map(map);
  next.set(key, value);
  return next;
}

/** Lädt die Bäume „Alle Dateien“ der offenen Knoten (`anchorKeys`) und hält sie je Session. Ein Baum lädt beim
 *  ersten Aufklappen und erneut, sobald sich `changesStamp` ändert (neues Ergebnis der Changes); bis dahin bleibt der
 *  alte stehen. */
export function useRepoTrees(
  sessionId: string,
  anchorKeys: readonly string[],
  changesStamp: string,
): RepoTreesState {
  const [trees, setTrees] = useState<ReadonlyMap<string, LoadState<RepoTree>>>(NO_TREES);
  const [ignoredChildren, setIgnoredChildren] =
    useState<ReadonlyMap<string, LoadState<DirEntry[]>>>(NO_CHILDREN);
  const [owner, setOwner] = useState<string>(sessionId);
  // Je Anker der Stempel, mit dem zuletzt geladen wurde; ein anderer Stempel lädt neu.
  const loadedRef = useRef<Map<string, string>>(new Map());
  const sessionRef = useRef<string>(sessionId);

  // Eine andere Session verwirft alles Geladene (State während des Renderns angleichen statt im Effekt).
  if (owner !== sessionId) {
    setOwner(sessionId);
    setTrees(NO_TREES);
    setIgnoredChildren(NO_CHILDREN);
  }

  const wanted: string = anchorKeys.join('\n');

  useEffect(() => {
    if (sessionRef.current !== sessionId) {
      sessionRef.current = sessionId;
      loadedRef.current = new Map();
    }
    for (const key of wanted === '' ? [] : wanted.split('\n')) {
      if (loadedRef.current.get(key) === changesStamp) {
        continue;
      }
      const isFirst: boolean = !loadedRef.current.has(key);
      loadedRef.current.set(key, changesStamp);
      if (isFirst) {
        setTrees((current) => withEntry(current, key, { status: 'loading' }));
      }
      loadRepoTree(sessionId, key)
        .then((tree: RepoTree) => {
          if (sessionRef.current === sessionId) {
            setTrees((current) => withEntry(current, key, { status: 'ready', value: tree }));
          }
        })
        .catch((reason: unknown) => {
          if (sessionRef.current === sessionId) {
            setTrees((current) =>
              withEntry(current, key, { status: 'error', message: commandErrorText(reason) }),
            );
          }
        });
    }
  }, [sessionId, wanted, changesStamp]);

  const loadIgnored = useCallback(
    (entryKey: string, path: string): void => {
      const key: string = ignoredKey(entryKey, path);
      if (ignoredChildren.has(key)) {
        return;
      }
      setIgnoredChildren((current) => withEntry(current, key, { status: 'loading' }));
      loadIgnoredChildren(sessionId, entryKey, path)
        .then((entries: DirEntry[]) => {
          if (sessionRef.current === sessionId) {
            setIgnoredChildren((current) =>
              withEntry(current, key, { status: 'ready', value: entries }),
            );
          }
        })
        .catch((reason: unknown) => {
          if (sessionRef.current === sessionId) {
            setIgnoredChildren((current) =>
              withEntry(current, key, { status: 'error', message: commandErrorText(reason) }),
            );
          }
        });
    },
    [sessionId, ignoredChildren],
  );

  return { trees, ignoredChildren, loadIgnored };
}
