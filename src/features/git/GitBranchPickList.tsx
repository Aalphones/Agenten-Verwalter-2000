import { useEffect, useState } from 'react';
import type { ChangeEvent, ReactElement } from 'react';
import { CloudIcon } from '@/features/git/GitIcons';
import type { GitBranch } from '@/lib/bindings/GitBranch';
import { commandErrorText } from '@/lib/errors';
import { loadGitBranches } from '@/lib/git';
import './GitMenu.css';

const SEARCH_PLACEHOLDER = 'Branch suchen';

interface GitBranchPickListProps {
  sessionId: string;
  entryKey: string;
  /** Welche Branches zur Wahl stehen. */
  isOffered: (branch: GitBranch) => boolean;
  /** Text, wenn nichts zur Wahl steht. */
  emptyText: string;
  onPick: (branch: GitBranch) => void;
}

/** Eine Liste der Branches eines Eintrags mit Suchfeld, aus der einer gewählt wird (Merge, Löschen). */
export function GitBranchPickList({
  sessionId,
  entryKey,
  isOffered,
  emptyText,
  onPick,
}: GitBranchPickListProps): ReactElement {
  const [branches, setBranches] = useState<GitBranch[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');

  useEffect(() => {
    const controller = new AbortController();
    loadGitBranches(sessionId, entryKey)
      .then((loaded: GitBranch[]) => {
        if (!controller.signal.aborted) {
          setBranches(loaded);
        }
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setLoadError(commandErrorText(reason));
        }
      });
    return (): void => {
      controller.abort();
    };
  }, [sessionId, entryKey]);

  function renderBranch(branch: GitBranch): ReactElement {
    return (
      <button
        key={`${branch.remote ? 'remote' : 'local'}:${branch.name}`}
        type="button"
        className="git-menu__item"
        onClick={(): void => {
          onPick(branch);
        }}
      >
        <span className="git-menu__check">{branch.remote && <CloudIcon />}</span>
        <span className="git-menu__label git-menu__mono">{branch.name}</span>
      </button>
    );
  }

  function renderList(): ReactElement {
    if (loadError !== null) {
      return <div className="git-menu__note">{loadError}</div>;
    }
    if (branches === null) {
      return <div className="git-menu__note">Branches werden gelesen …</div>;
    }
    const query: string = search.trim().toLowerCase();
    const matching: GitBranch[] = branches.filter(
      (branch: GitBranch) =>
        isOffered(branch) && (query === '' || branch.name.toLowerCase().includes(query)),
    );
    if (matching.length === 0) {
      return <div className="git-menu__note">{emptyText}</div>;
    }
    return <div className="git-menu__list">{matching.map(renderBranch)}</div>;
  }

  return (
    <>
      <input
        type="text"
        className="git-menu__search"
        placeholder={SEARCH_PLACEHOLDER}
        aria-label={SEARCH_PLACEHOLDER}
        value={search}
        onChange={(event: ChangeEvent<HTMLInputElement>): void => {
          setSearch(event.target.value);
        }}
      />
      {renderList()}
    </>
  );
}
