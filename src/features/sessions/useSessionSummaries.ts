import { useCallback, useEffect, useState } from 'react';
import type { UnlistenFn } from '@tauri-apps/api/event';
import type { SessionSummary } from '@/lib/bindings/SessionSummary';
import { listSessions, onSessionChanged } from '@/lib/sessions';

export interface SessionSummaries {
  sessions: SessionSummary[];
  /** Fügt eine Session ein oder ersetzt die mit gleicher `id` — für Rückgaben, zu denen der Core kein Ereignis sendet. */
  upsertSession: (summary: SessionSummary) => void;
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

  const upsertSession = useCallback((summary: SessionSummary): void => {
    setSessions((current: SessionSummary[]) => upsert(current, summary));
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
      });

    return (): void => {
      controller.abort();
      if (unlisten !== null) {
        unlisten();
      }
    };
  }, [upsertSession]);

  return { sessions, upsertSession };
}
