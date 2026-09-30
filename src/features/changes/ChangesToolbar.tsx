import type { ReactElement } from 'react';
import {
  countFilesInScope,
  fileCountLabel,
  formatCount,
  sumLines,
} from '@/features/changes/changesScope';
import type { ChangeScope } from '@/lib/bindings/ChangeScope';
import type { RepositoryChanges } from '@/lib/bindings/RepositoryChanges';
import type { SessionChanges } from '@/lib/bindings/SessionChanges';
import type { ChangesSelection } from '@/stores/changes';
import './ChangesToolbar.css';

const MIN_REPOSITORIES_FOR_CHIPS = 2;
const BASE_TITLE = 'Basis: gegen diesen Stand werden alle Änderungen der Session gemessen';

const SCOPE_OPTIONS: readonly { scope: ChangeScope; label: string; title: string }[] = [
  { scope: 'all', label: 'Alle', title: 'Alles seit der Basis, committed und uncommitted' },
  {
    scope: 'uncommitted',
    label: 'Uncommitted',
    title: 'Nur im Arbeitsverzeichnis, noch nicht committed',
  },
  { scope: 'committed', label: 'Committed', title: 'Schon als Commit im Session-Branch' },
];

interface ChangesToolbarProps {
  changes: SessionChanges;
  selection: ChangesSelection;
  onRepositoryFilter: (key: string | null) => void;
  onScope: (scope: ChangeScope) => void;
}

export function ChangesToolbar({
  changes,
  selection,
  onRepositoryFilter,
  onScope,
}: ChangesToolbarProps): ReactElement {
  const { repositoryFilter, scope } = selection;
  const visible: RepositoryChanges[] = changes.repositories.filter(
    (repository: RepositoryChanges) =>
      repositoryFilter === null || repository.key === repositoryFilter,
  );
  let fileCount = 0;
  let added = 0;
  let deleted = 0;
  for (const repository of visible) {
    const sums = sumLines(repository, scope);
    fileCount += countFilesInScope(repository, scope);
    added += sums.added;
    deleted += sums.deleted;
  }

  function renderChips(): ReactElement | null {
    if (changes.repositories.length < MIN_REPOSITORIES_FOR_CHIPS) {
      return null;
    }
    return (
      <div className="changes-toolbar__chips" role="group" aria-label="Repository-Filter">
        <Chip
          label="Alle"
          count={sessionFileCount(changes, scope)}
          isPressed={repositoryFilter === null}
          onPick={(): void => {
            onRepositoryFilter(null);
          }}
        />
        {changes.repositories.map((repository: RepositoryChanges) => (
          <Chip
            key={repository.key}
            label={repository.name}
            count={countFilesInScope(repository, scope)}
            isPressed={repositoryFilter === repository.key}
            onPick={(): void => {
              onRepositoryFilter(repository.key);
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="changes-toolbar">
      {renderChips()}
      <div className="changes-toolbar__spacer" />
      <div className="changes-toolbar__summary">
        <span>{fileCountLabel(fileCount)}</span>
        <span className="changes-toolbar__added">+{formatCount(added)}</span>
        <span className="changes-toolbar__deleted">−{formatCount(deleted)}</span>
        <BaseLabel repositories={visible.length > 0 ? visible : changes.repositories} />
      </div>
      <div className="changes-toolbar__segment" role="group" aria-label="Commit-Stand">
        {SCOPE_OPTIONS.map((option) => (
          <button
            key={option.scope}
            type="button"
            className={`changes-toolbar__segment-button${
              option.scope === scope ? ' changes-toolbar__segment-button--pressed' : ''
            }`}
            aria-pressed={option.scope === scope}
            title={option.title}
            onClick={(): void => {
              onScope(option.scope);
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Dateien im Blickwinkel über alle Repositories — die Zahl des Chips „Alle“. */
function sessionFileCount(changes: SessionChanges, scope: ChangeScope): number {
  let total = 0;
  for (const repository of changes.repositories) {
    total += countFilesInScope(repository, scope);
  }
  return total;
}

interface ChipProps {
  label: string;
  count: number;
  isPressed: boolean;
  onPick: () => void;
}

function Chip({ label, count, isPressed, onPick }: ChipProps): ReactElement {
  return (
    <button
      type="button"
      className={`changes-toolbar__chip${isPressed ? ' changes-toolbar__chip--pressed' : ''}`}
      aria-pressed={isPressed}
      onClick={onPick}
    >
      {label}
      <span className="changes-toolbar__chip-count">{formatCount(count)}</span>
    </button>
  );
}

interface BaseLabelProps {
  repositories: readonly RepositoryChanges[];
}

function BaseLabel({ repositories }: BaseLabelProps): ReactElement {
  const first: RepositoryChanges | undefined = repositories[0];
  const hasSharedBase: boolean =
    first !== undefined &&
    repositories.every((repository: RepositoryChanges) => repository.baseRef === first.baseRef);
  const title: string = hasSharedBase
    ? BASE_TITLE
    : [
        BASE_TITLE,
        ...repositories.map(
          (repository: RepositoryChanges) => `${repository.name}: ${repository.baseRef}`,
        ),
      ].join('\n');
  return (
    <span className="changes-toolbar__base" title={title}>
      <svg
        width="13"
        height="13"
        viewBox="0 0 14 14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="4" cy="3" r="1.5" />
        <circle cx="4" cy="11" r="1.5" />
        <circle cx="10.5" cy="4.5" r="1.5" />
        <path d="M4 4.5v5M10.5 6c0 2.2-2 3-5.3 3.8" />
      </svg>
      {hasSharedBase && first !== undefined ? (
        <span>
          gegen <span className="changes-toolbar__mono">{first.baseRef}</span>
        </span>
      ) : (
        <span>gegen die Basis je Repository</span>
      )}
    </span>
  );
}
