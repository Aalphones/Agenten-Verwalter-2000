import { useState } from 'react';
import type { ReactElement } from 'react';
import {
  countChangedFiles,
  fileCountLabel,
  formatCount,
  sumLines,
  type LineSums,
} from '@/features/changes/changesScope';
import { ProjectSessionCard } from '@/features/projects/ProjectSessionCard';
import type { ProjectSummary } from '@/lib/bindings/ProjectSummary';
import type { SessionChanges } from '@/lib/bindings/SessionChanges';
import type { SessionSummary } from '@/lib/bindings/SessionSummary';
import { commandErrorText } from '@/lib/errors';
import { effortLabel, modeOption, modelName } from '@/lib/labels';
import { createSessionInProject } from '@/lib/sessions';
import './ProjectOverview.css';

const NEW_SESSION_TITLE =
  'Startet eine frische Claude-Session in diesem Vorhaben: gleiche Repositories und gleicher Arbeitsordner, aber ohne den bisherigen Verlauf.';

interface ProjectOverviewProps {
  project: ProjectSummary;
  /** Sessions des Vorhabens, aufsteigend nach Nummer. */
  sessions: readonly SessionSummary[];
  /** `null`, solange die Changes nicht gelesen sind. */
  changes: SessionChanges | null;
  onOpenSession: (sessionId: string) => void;
  onSessionCreated: (summary: SessionSummary) => void;
}

export function ProjectOverview({
  project,
  sessions,
  changes,
  onOpenSession,
  onSessionCreated,
}: ProjectOverviewProps): ReactElement {
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function createSession(): void {
    setIsCreating(true);
    setErrorMessage(null);
    createSessionInProject(project.id)
      .then(onSessionCreated)
      .catch((reason: unknown) => {
        setErrorMessage(commandErrorText(reason));
      })
      .finally(() => {
        setIsCreating(false);
      });
  }

  function renderChangesSummary(): ReactElement | null {
    if (changes === null) {
      return null;
    }
    const sums: LineSums = { added: 0, deleted: 0 };
    for (const repository of changes.repositories) {
      const repositorySums: LineSums = sumLines(repository, 'all');
      sums.added += repositorySums.added;
      sums.deleted += repositorySums.deleted;
    }
    return (
      <>
        <span className="project-overview__changes">
          Changes: {fileCountLabel(countChangedFiles(changes))}
        </span>
        <span className="project-overview__added">+{formatCount(sums.added)}</span>
        <span className="project-overview__deleted">−{formatCount(sums.deleted)}</span>
      </>
    );
  }

  function renderRepositories(): ReactElement {
    if (project.repositoryNames.length === 0) {
      return (
        <div className="project-overview__repositories">
          <span>Keine Repositories</span>
        </div>
      );
    }
    return (
      <div className="project-overview__repositories">
        <span>Repositories</span>
        {project.repositoryNames.map((name: string) => (
          <span key={name} className="project-overview__chip">
            {name}
          </span>
        ))}
        {renderChangesSummary()}
      </div>
    );
  }

  return (
    <div className="project-overview">
      <div className="project-overview__column">
        {renderRepositories()}
        <section className="project-overview__sessions">
          <div className="project-overview__sessions-head">
            <div className="project-overview__sessions-title">
              <h2 className="project-overview__heading">
                Sessions <span className="project-overview__count">{sessions.length}</span>
              </h2>
              <p className="project-overview__note">
                Jede Session ist ein eigener Claude-Verlauf mit frischem Kontext.
              </p>
            </div>
            <span className="project-overview__carry">{carryText(sessions)}</span>
            <button
              type="button"
              className="project-overview__new"
              title={NEW_SESSION_TITLE}
              disabled={isCreating}
              onClick={createSession}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M6 2v8M2 6h8" />
              </svg>
              Neue Session
            </button>
          </div>
          {errorMessage !== null && <p className="project-overview__error">{errorMessage}</p>}
          <div className="project-overview__cards">
            {sessions.map((session: SessionSummary) => (
              <ProjectSessionCard key={session.id} session={session} onOpen={onOpenSession} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

/** Was die nächste neue Session übernimmt; gibt es die noch nicht gestartete schon, steht das da. */
function carryText(sessions: readonly SessionSummary[]): string {
  const latest: SessionSummary | undefined = sessions[sessions.length - 1];
  if (latest === undefined) {
    return '';
  }
  if (latest.status === 'new') {
    return `#${String(latest.number)} ist noch nicht gestartet`;
  }
  return `übernimmt ${modelName(latest.model)} · ${effortLabel(latest.effort)} · ${modeOption(latest.mode).label} aus #${String(latest.number)}`;
}
