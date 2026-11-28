import { useCallback, useEffect, useRef, useState } from 'react';
import { commandErrorText } from '@/lib/errors';
import { removeMcpServer } from '@/lib/mcp';

/** So lange lässt sich ein Entfernen zurücknehmen, bevor es geschrieben wird. */
export const UNDO_MS = 6000;

/** Hier entfernte Servernamen: ein laufender Agent meldet sie bis zu seinem Neustart weiter. Über
 *  das Schließen des Dialogs hinaus, weil eine offene Entfernung erst dabei geschrieben wird. */
const removedNames = new Set<string>();

export interface RemovalTarget {
  key: string;
  sessionId: string;
  sourceId: string;
  name: string;
}

export interface UndoableRemoval {
  /** Die Zeile, die gerade als Rückgängig-Zeile steht. */
  pendingKey: string | null;
  /** Zeilen, deren Entfernen geschrieben wird, bis die neue Konfiguration da ist. */
  committingKeys: ReadonlySet<string>;
  removedNames: ReadonlySet<string>;
  remove: (target: RemovalTarget) => void;
  undo: () => void;
}

interface Pending {
  target: RemovalTarget;
  timer: number;
}

/** Entfernen ohne Rückfrage: geschrieben wird erst nach `UNDO_MS`, mit der nächsten Entfernung oder
 *  beim Schließen des Dialogs; bis dahin nimmt `undo` (auch Strg+Z) es zurück. */
export function useUndoableRemoval(
  reloadConfig: () => Promise<void>,
  onFailure: (text: string | null) => void,
): UndoableRemoval {
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [committingKeys, setCommittingKeys] = useState<ReadonlySet<string>>(new Set<string>());
  const pendingRef = useRef<Pending | null>(null);
  const callbacksRef = useRef({ reloadConfig, onFailure });
  const commitRef = useRef<() => void>(() => undefined);

  const takePending = useCallback((): RemovalTarget | null => {
    const pending: Pending | null = pendingRef.current;
    if (pending === null) {
      return null;
    }
    window.clearTimeout(pending.timer);
    pendingRef.current = null;
    setPendingKey(null);
    return pending.target;
  }, []);

  const commit = useCallback((): void => {
    const target: RemovalTarget | null = takePending();
    if (target === null) {
      return;
    }
    removedNames.add(target.name);
    setCommittingKeys((keys: ReadonlySet<string>) => new Set<string>([...keys, target.key]));
    removeMcpServer(target.sessionId, target.sourceId, target.name)
      .then(() => callbacksRef.current.reloadConfig())
      .catch((reason: unknown) => {
        removedNames.delete(target.name);
        console.error('MCP-Server nicht entfernt', reason);
        callbacksRef.current.onFailure(commandErrorText(reason));
      })
      .finally(() => {
        setCommittingKeys(
          (keys: ReadonlySet<string>) =>
            new Set<string>([...keys].filter((key: string) => key !== target.key)),
        );
      });
  }, [takePending]);

  const undo = useCallback((): void => {
    takePending();
  }, [takePending]);

  function remove(target: RemovalTarget): void {
    commit();
    onFailure(null);
    pendingRef.current = { target, timer: window.setTimeout(commit, UNDO_MS) };
    setPendingKey(target.key);
  }

  useEffect(() => {
    callbacksRef.current = { reloadConfig, onFailure };
    commitRef.current = commit;
  });

  // Schließen führt eine offene Entfernung sofort aus.
  useEffect(
    () => (): void => {
      commitRef.current();
    },
    [],
  );

  useEffect(() => {
    if (pendingKey === null) {
      return undefined;
    }
    function handleKeyDown(event: KeyboardEvent): void {
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        event.stopPropagation();
        undo();
      }
    }
    window.addEventListener('keydown', handleKeyDown, true);
    return (): void => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [pendingKey, undo]);

  return { pendingKey, committingKeys, removedNames, remove, undo };
}
