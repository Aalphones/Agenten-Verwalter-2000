import { useCallback, useEffect, useState } from 'react';
import type { UnlistenFn } from '@tauri-apps/api/event';
import type { ProjectSummary } from '@/lib/bindings/ProjectSummary';
import { commandErrorText } from '@/lib/errors';
import { listProjects, onProjectChanged } from '@/lib/projects';

export interface ProjectSummaries {
  projects: ProjectSummary[];
  /** Fügt ein Vorhaben ein oder ersetzt das mit gleicher `id` — für Rückgaben, zu denen der Core kein Ereignis sendet. */
  upsertProject: (summary: ProjectSummary) => void;
  /** Nimmt ein Vorhaben aus der Liste — für archivierte, zu denen der Core kein Ereignis sendet. */
  removeProject: (projectId: string) => void;
  /** Satz zum Lade- oder Abo-Fehler (Ladefehler zuerst); `null` ohne Fehler. */
  error: string | null;
}

function newestFirst(first: ProjectSummary, second: ProjectSummary): number {
  return second.createdAt - first.createdAt;
}

export function useProjectSummaries(): ProjectSummaries {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [subscribeError, setSubscribeError] = useState<string | null>(null);

  const upsertProject = useCallback((summary: ProjectSummary): void => {
    setProjects((current: ProjectSummary[]) => {
      const others: ProjectSummary[] = current.filter(
        (candidate: ProjectSummary) => candidate.id !== summary.id,
      );
      return [...others, summary].sort(newestFirst);
    });
  }, []);

  const removeProject = useCallback((projectId: string): void => {
    setProjects((current: ProjectSummary[]) =>
      current.filter((candidate: ProjectSummary) => candidate.id !== projectId),
    );
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let unlisten: UnlistenFn | null = null;

    // Erst abonnieren, dann laden: ein Ereignis zwischen beiden Schritten geht sonst verloren.
    onProjectChanged((summary: ProjectSummary) => {
      upsertProject(summary);
    })
      .then((stop: UnlistenFn) => {
        if (controller.signal.aborted) {
          stop();
          return;
        }
        unlisten = stop;
      })
      .catch((reason: unknown) => {
        console.error('Vorhaben-Ereignisse nicht abonnierbar', reason);
        setSubscribeError(`Vorhaben werden nicht mehr aktualisiert: ${commandErrorText(reason)}`);
      });

    listProjects()
      .then((listed: ProjectSummary[]) => {
        if (controller.signal.aborted) {
          return;
        }
        // Ein bereits eingetroffenes Ereignis ist neuer als der Listenstand — es behält Vorrang.
        setProjects((current: ProjectSummary[]) => {
          const knownIds = new Set<string>(
            current.map((candidate: ProjectSummary) => candidate.id),
          );
          const unseen: ProjectSummary[] = listed.filter(
            (candidate: ProjectSummary) => !knownIds.has(candidate.id),
          );
          return [...current, ...unseen].sort(newestFirst);
        });
      })
      .catch((reason: unknown) => {
        console.error('Vorhaben nicht ladbar', reason);
        if (!controller.signal.aborted) {
          setLoadError(`Vorhaben nicht ladbar: ${commandErrorText(reason)}`);
        }
      });

    return (): void => {
      controller.abort();
      if (unlisten !== null) {
        unlisten();
      }
    };
  }, [upsertProject]);

  return { projects, upsertProject, removeProject, error: loadError ?? subscribeError };
}
