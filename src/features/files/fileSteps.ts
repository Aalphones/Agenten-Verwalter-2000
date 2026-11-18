import type { HistoryCommit } from '@/lib/bindings/HistoryCommit';
import type { HistoryFile } from '@/lib/bindings/HistoryFile';
import type { ProjectHistory } from '@/lib/bindings/ProjectHistory';

/** Ein Schritt einer Datei: ein eigener Commit, der sie in dieser Gruppe ändert. */
export interface FileStep {
  commit: HistoryCommit;
  file: HistoryFile;
  sessionId: string;
  sessionNumber: number;
  sessionName: string;
}

/** Die Schritte einer Datei in einer Gruppe, älteste zuerst. */
export function fileSteps(history: ProjectHistory | null, group: string, path: string): FileStep[] {
  const steps = new Map<string, FileStep>();
  for (const session of history?.sessions ?? []) {
    for (const commit of session.commits) {
      if (commit.group !== group || steps.has(commit.id)) {
        continue;
      }
      const file: HistoryFile | undefined = commit.files.find(
        (candidate: HistoryFile) => candidate.path === path,
      );
      if (file !== undefined) {
        steps.set(commit.id, {
          commit,
          file,
          sessionId: session.sessionId,
          sessionNumber: session.number,
          sessionName: session.name,
        });
      }
    }
  }
  return [...steps.values()].sort(
    (first: FileStep, second: FileStep) => first.commit.time - second.commit.time,
  );
}

/** ID des jüngsten Schritts einer Session an der Datei; `null`, wenn die Session sie nicht geändert hat. */
export function latestStepOfSession(steps: readonly FileStep[], sessionId: string): string | null {
  for (let index = steps.length - 1; index >= 0; index -= 1) {
    const step: FileStep | undefined = steps[index];
    if (step?.sessionId === sessionId) {
      return step.commit.id;
    }
  }
  return null;
}
