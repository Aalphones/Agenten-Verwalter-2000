import { useEffect, useState } from 'react';
import type { Artifact } from '@/lib/bindings/Artifact';
import type { ArtifactList } from '@/lib/bindings/ArtifactList';
import { listArtifacts } from '@/lib/artifacts';
import { commandErrorText } from '@/lib/errors';

const POLL_MS = 2000;

interface LoadedList {
  projectId: string;
  list: ArtifactList;
}

/** Was die Oberfläche sieht: ändert sich der Schlüssel nicht, wird nicht neu gerendert. */
function listKey(list: ArtifactList): string {
  const rows: string[] = list.items.map(
    (item: Artifact) =>
      `${item.file}|${String(item.modifiedAt)}|${item.title}|${item.sessionId ?? ''}|${item.sessionName ?? ''}`,
  );
  return [list.dir, list.baseUrl, ...rows].join('\n');
}

/** Die Artefakte des Vorhabens, zu dem `sessionId` gehört, alle `POLL_MS` neu gelesen (keine Ereignisse: auch
 *  per Shell geschriebene Seiten erscheinen). `null` für beide: nichts sichtbar, keine Abfrage. Wechselt das
 *  Vorhaben, ist die Liste bis zur ersten Antwort `null`. */
export function useProjectArtifacts(
  sessionId: string | null,
  projectId: string | null,
): { list: ArtifactList | null; error: string | null } {
  const [loaded, setLoaded] = useState<LoadedList | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionId === null || projectId === null) {
      return undefined;
    }
    const controller = new AbortController();

    function load(): void {
      if (sessionId === null || projectId === null) {
        return;
      }
      listArtifacts(sessionId)
        .then((next: ArtifactList) => {
          if (controller.signal.aborted) {
            return;
          }
          setLoaded((current: LoadedList | null) =>
            current !== null &&
            current.projectId === projectId &&
            listKey(current.list) === listKey(next)
              ? current
              : { projectId, list: next },
          );
          setError(null);
        })
        .catch((reason: unknown) => {
          if (controller.signal.aborted) {
            return;
          }
          console.error('Artefakte nicht gelesen', reason);
          setError(commandErrorText(reason));
        });
    }

    function poll(): void {
      if (!document.hidden) {
        load();
      }
    }

    load();
    const timer: number = window.setInterval(poll, POLL_MS);
    document.addEventListener('visibilitychange', poll);
    return (): void => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', poll);
    };
  }, [sessionId, projectId]);

  const isCurrent: boolean = loaded !== null && loaded.projectId === projectId;
  return { list: isCurrent && loaded !== null ? loaded.list : null, error };
}
