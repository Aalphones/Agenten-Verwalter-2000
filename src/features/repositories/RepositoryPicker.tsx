import { open } from '@tauri-apps/plugin-dialog';
import { useState } from 'react';
import type { ChangeEvent, ReactElement } from 'react';
import { useKnownRepositories } from '@/features/repositories/useKnownRepositories';
import type { KnownRepository } from '@/lib/bindings/KnownRepository';
import './RepositoryPicker.css';

const INFO_TEXT =
  'Beim Start legt die App in jedem gewählten Repository den Branch verwalter/<Name der Session> an, ausgehend vom gerade ausgecheckten Stand, und checkt ihn in einem eigenen Ordner aus. Dein Arbeitsordner bleibt unverändert.';

interface RepositoryPickerProps {
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
}

export function RepositoryPicker({ selectedIds, onChange }: RepositoryPickerProps): ReactElement {
  const { repositories, add, remove } = useKnownRepositories();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function toggle(id: string, isChecked: boolean): void {
    if (isChecked) {
      onChange([...selectedIds, id]);
      return;
    }
    onChange(selectedIds.filter((selectedId: string) => selectedId !== id));
  }

  function handleAdd(): void {
    setErrorMessage(null);
    open({ directory: true, multiple: false, title: 'Repository wählen' })
      .then(async (path: string | null): Promise<void> => {
        if (path === null) {
          return;
        }
        const repository: KnownRepository = await add(path);
        if (!selectedIds.includes(repository.id)) {
          onChange([...selectedIds, repository.id]);
        }
      })
      .catch((reason: unknown) => {
        setErrorMessage(describeAddError(reason));
      });
  }

  function handleRemove(id: string): void {
    remove(id)
      .then((): void => {
        onChange(selectedIds.filter((selectedId: string) => selectedId !== id));
      })
      .catch((reason: unknown) => {
        setErrorMessage(describeAddError(reason));
      });
  }

  function renderRow(repository: KnownRepository): ReactElement {
    return (
      <li key={repository.id} className="repository-picker__row">
        <label className="repository-picker__label">
          <input
            type="checkbox"
            className="repository-picker__check"
            disabled={repository.isMissing}
            checked={selectedIds.includes(repository.id)}
            onChange={(event: ChangeEvent<HTMLInputElement>): void => {
              toggle(repository.id, event.target.checked);
            }}
          />
          <span className="repository-picker__name">{repository.name}</span>
          <span className="repository-picker__path" title={repository.path}>
            {repository.path}
          </span>
          {renderTrailing(repository)}
        </label>
        {repository.isMissing && (
          <button
            type="button"
            className="repository-picker__remove"
            onClick={(): void => {
              handleRemove(repository.id);
            }}
          >
            Entfernen
          </button>
        )}
      </li>
    );
  }

  function renderList(): ReactElement {
    if (repositories.length === 0) {
      return (
        <p className="repository-picker__empty">
          Noch keine Repositories. Ohne Repository arbeitet der Agent in einem leeren Ordner.
        </p>
      );
    }
    return <ul className="repository-picker__list">{repositories.map(renderRow)}</ul>;
  }

  return (
    <fieldset className="repository-picker">
      <legend className="repository-picker__heading">
        <span className="repository-picker__step">2</span>
        Repositories
      </legend>
      {renderList()}
      <div className="repository-picker__actions">
        <button type="button" className="repository-picker__add" onClick={handleAdd}>
          <svg
            width="12"
            height="12"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M7 2.5v9M2.5 7h9" />
          </svg>
          Repository hinzufügen …
        </button>
        <span className="repository-picker__info" title={INFO_TEXT}>
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
            <circle cx="7" cy="7" r="5.5" />
            <path d="M7 6.4v3.4" />
            <circle cx="7" cy="4.3" r="0.5" fill="currentColor" />
          </svg>
          Jedes Repository bekommt einen eigenen Worktree. Seine Skills stehen in der Session zur
          Verfügung.
        </span>
      </div>
      {errorMessage !== null && (
        <p className="repository-picker__error" role="alert">
          {errorMessage}
        </p>
      )}
    </fieldset>
  );
}

function renderTrailing(repository: KnownRepository): ReactElement {
  if (repository.isMissing) {
    return <span className="repository-picker__missing">nicht gefunden</span>;
  }
  return <span className="repository-picker__skills">{skillLabel(repository.skillCount)}</span>;
}

function skillLabel(count: number): string {
  if (count === 0) {
    return 'keine Skills';
  }
  return count === 1 ? '1 Skill' : `${String(count)} Skills`;
}

function describeAddError(reason: unknown): string {
  if (typeof reason === 'object' && reason !== null && 'kind' in reason) {
    if (reason.kind === 'gitNotFound') {
      return 'Git nicht gefunden. Installiere Git für Windows und starte die App neu.';
    }
    if (reason.kind === 'notARepository' && 'message' in reason) {
      return `Der Ordner ist kein Git-Repository: ${String(reason.message)}`;
    }
  }
  if (typeof reason === 'object' && reason !== null && 'message' in reason) {
    return String(reason.message);
  }
  return String(reason);
}
