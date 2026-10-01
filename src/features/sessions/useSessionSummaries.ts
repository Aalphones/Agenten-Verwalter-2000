import { useCallback, useEffect, useState } from 'react';
import type { UnlistenFn } from '@tauri-apps/api/event';
import type { SessionSummary } from '@/lib/bindings/SessionSummary';
import { commandErrorText } from '@/lib/errors';
import { listSessions, onSessionChanged } from '@/lib/sessions';

export interface SessionSummaries {
  sessions: SessionSummary[];
  /** Fügt eine Session ein oder ersetzt die mit gleicher `id` — für Rückgaben, zu denen der Core kein Ereignis sendet. */
  upsertSession: (summary: SessionSummary) => void;
  /** Nimmt eine Session aus der Liste — für archivierte, zu denen der Core kein Ereignis sendet. */
  removeSession: (sessionId: string) => void;
  /** Satz zum Lade- oder Abo-Fehler (Ladefehler zuerst); `null` ohne Fehler. */
  error: string | null;
}

function upsert(current: readonly SessionSummary[], summary: SessionSummary): SessionSummary[] {
  const others: SessionSummary[] = current.filter(
    (candidate: SessionSummary) => candidate.id !== summary.id,
  );
  return [...others, summary].sort(
    (first: SessionSummary, second: SessionSummary) => second.createdAt - first.createdAt,
  );
}

export function useSessionSummaries(): SessionSummaries {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [subscribeError, setSubscribeError] = useState<string | null>(null);

  const upsertSession = useCallback((summary: SessionSummary): void => {
    setSessions((current: SessionSummary[]) => upsert(current, summary));
  }, []);

  const removeSession = useCallback((sessionId: string): void => {
    setSessions((current: SessionSummary[]) =>
      current.filter((candidate: SessionSummary) => candidate.id !== sessionId),
    );
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let unlisten: UnlistenFn | null = null;

    // Erst abonnieren, dann laden: ein Ereignis zwischen beiden Schritten geht sonst verloren.
    onSessionChanged((summary: SessionSummary) => {
      upsertSession(summary);
    })
      .then((stop: UnlistenFn) => {
        if (controller.signal.aborted) {
          stop();
          return;
        }
        unlisten = stop;
      })
      .catch((reason: unknown) => {
        console.error('Session-Ereignisse nicht abonnierbar', reason);
        setSubscribeError(`Sessions werden nicht mehr aktualisiert: ${commandErrorText(reason)}`);
      });

    listSessions()
      .then((listed: SessionSummary[]) => {
        if (controller.signal.aborted) {
          return;
        }
        // Ein bereits eingetroffenes Ereignis ist neuer als der Listenstand — es behält Vorrang.
        setSessions((current: SessionSummary[]) => {
          const knownIds = new Set<string>(
            current.map((candidate: SessionSummary) => candidate.id),
          );
          const unseen: SessionSummary[] = listed.filter(
            (candidate: SessionSummary) => !knownIds.has(candidate.id),
          );
          return [...current, ...unseen].sort(
            (first: SessionSummary, second: SessionSummary) => second.createdAt - first.createdAt,
          );
        });
      })
      .catch((reason: unknown) => {
        console.error('Sessions nicht ladbar', reason);
        if (!controller.signal.aborted) {
          setLoadError(`Sessions nicht ladbar: ${commandErrorText(reason)}`);
        }
      });

    return (): void => {
      controller.abort();
      if (unlisten !== null) {
        unlisten();
      }
    };
  }, [upsertSession]);

  return { sessions, upsertSession, removeSession, error: loadError ?? subscribeError };
}
