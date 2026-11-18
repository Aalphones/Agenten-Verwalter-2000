import { useMemo } from 'react';
import type { ReactElement } from 'react';
import { buildFileRows } from '@/features/changes/buildFileRows';
import type { FileRow } from '@/features/changes/buildFileRows';
import { FileTree } from '@/features/changes/FileTree';
import { entryKindLabel } from '@/features/git/gitTexts';
import { BranchIcon } from '@/features/git/GitIcons';
import { GitHistory } from '@/features/git/GitHistory';
import { GitLockHint } from '@/features/git/GitLockHint';
import type { ChangeScope } from '@/lib/bindings/ChangeScope';
import type { GitEntryStatus } from '@/lib/bindings/GitEntryStatus';
import type { GitSessionStatus } from '@/lib/bindings/GitSessionStatus';
import type { RepositoryChanges } from '@/lib/bindings/RepositoryChanges';
import type { SessionChanges } from '@/lib/bindings/SessionChanges';
import { useGitStore } from '@/stores/git';
import './GitPage.css';

const NO_FLAGS: Readonly<Record<string, boolean>> = {};
const GIT_SCOPE: ChangeScope = 'all';

const NOT_WORKED_TEXT =
  'In diesem Repository hat diese Session nicht gearbeitet. Die Git-Werkzeuge stehen in der Session, die es getan hat.';

interface GitPageProps {
  /** Session, deren Git-Zustand und Changes die Seite zeigt. */
  sessionId: string;
  /** Name des Repository-Knotens. */
  groupName: string;
  /** `group` des Repository-Knotens. */
  group: string;
  /** Changes der Reichweite `session`. */
  changes: SessionChanges;
  git: GitSessionStatus;
  onBack: () => void;
  /** Öffnet die Datei im Betrachter; `scope` ist der Blickwinkel der Zeile (`null`: alle). */
  onOpenFile: (entryKey: string, path: string, scope: ChangeScope | null) => void;
  /** Lädt nach einer Git-Aktion Git-Zustand, Changes, Baum und Verlauf neu. */
  onChanged: () => void;
}

interface GitSection {
  repository: RepositoryChanges;
  entry: GitEntryStatus;
  rows: FileRow[];
}

/** Die Git-Seite eines Repository-Knotens: je Eintrag, den der Git-Zustand der Session kennt, Git-Leiste, Dateiliste
 *  mit allen Git-Zeilen und Verlauf. */
export function GitPage({
  sessionId,
  groupName,
  group,
  changes,
  git,
  onBack,
  onOpenFile,
  onChanged,
}: GitPageProps): ReactElement {
  const showForeign: Readonly<Record<string, boolean>> = useGitStore(
    (state) => state.sessions[sessionId]?.showForeign ?? NO_FLAGS,
  );

  const sections: GitSection[] = useMemo(() => {
    const open: Record<string, boolean> = {};
    for (const entry of git.entries) {
      open[entry.key] = true;
    }
    const result: GitSection[] = [];
    for (const repository of changes.repositories) {
      const entry: GitEntryStatus | undefined = git.entries.find(
        (candidate: GitEntryStatus) => candidate.key === repository.key,
      );
      if (repository.group !== group || entry === undefined) {
        continue;
      }
      result.push({
        repository,
        entry,
        rows: buildFileRows(changes, repository.key, GIT_SCOPE, { status: git, open, showForeign }),
      });
    }
    return result;
  }, [changes, git, group, showForeign]);

  const isBusy: boolean = git.busy.length > 0;

  return (
    <div className="git-page">
      <div className="git-page__head">
        <button type="button" className="files-button files-button--small" onClick={onBack}>
          ← Übersicht
        </button>
        <span className="git-page__title">
          <BranchIcon />
          Git · {groupName}
        </span>
      </div>
      <div className="git-page__body">
        <GitLockHint sessionId={sessionId} busy={git.busy} />
        {sections.length === 0 && <p className="git-page__note">{NOT_WORKED_TEXT}</p>}
        {sections.map((section: GitSection) => (
          <section key={section.repository.key} className="git-page__section">
            {sections.length > 1 && (
              <h3 className="git-page__heading">
                {entryKindLabel(section.repository.key, section.repository.name)} ·{' '}
                {section.repository.name}
              </h3>
            )}
            <FileTree
              embedded
              rows={section.rows}
              scope={GIT_SCOPE}
              openFile={null}
              onOpen={(file): void => {
                onOpenFile(file.key, file.path, file.scope);
              }}
              git={{ sessionId, busy: git.busy, onChanged, isPinnedOpen: true }}
            />
            <GitHistory
              sessionId={sessionId}
              entry={section.entry}
              entryName={section.repository.name}
              isBusy={isBusy}
              onChanged={onChanged}
            />
          </section>
        ))}
      </div>
    </div>
  );
}
