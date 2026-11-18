import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FocusEvent, KeyboardEvent, MouseEvent, ReactElement } from 'react';
import { formatCount } from '@/features/changes/changesScope';
import type { LoadState } from '@/features/files/buildTreeRows';
import { ChangeMarks } from '@/features/files/ChangeMarks';
import { FileTypeIcon } from '@/features/files/FileTypeIcon';
import type { RepoGroup } from '@/features/files/mergeGroups';
import { searchFiles } from '@/features/files/searchFiles';
import type { SearchHit, SearchOutcome } from '@/features/files/searchFiles';
import type { RepoTree } from '@/lib/bindings/RepoTree';
import './FileSearch.css';

interface FileSearchProps {
  groups: readonly RepoGroup[];
  /** Je Anker-Schlüssel der geladene Baum. */
  trees: ReadonlyMap<string, LoadState<RepoTree>>;
  query: string;
  onQuery: (query: string) => void;
  /** Beim ersten Fokus: alle Bäume laden. */
  onActivate: () => void;
  /** Stand des Strg-P-Signals und der Teil davon, den die Suche schon bedient hat. */
  focusRequest: number;
  focusDone: number;
  onFocusHandled: () => void;
  onSelect: (hit: SearchHit) => void;
}

const NO_OUTCOME: SearchOutcome = { hits: [], matchCount: 0, fileCount: 0, pendingGroups: 0 };

function lastSegment(path: string): { dir: string; name: string } {
  const cut: number = path.lastIndexOf('/');
  return { dir: cut < 0 ? '' : path.slice(0, cut), name: path.slice(cut + 1) };
}

function renderName(name: string, nameMatch: [number, number] | null): ReactElement {
  if (nameMatch === null) {
    return <>{name}</>;
  }
  const [start, end] = nameMatch;
  return (
    <>
      {name.slice(0, start)}
      <mark>{name.slice(start, end)}</mark>
      {name.slice(end)}
    </>
  );
}

/** Suchfeld der Leiste mit der Trefferliste darunter: findet Dateien aller Repositories nach Name und Pfad.
 *  Pfeiltasten wählen, Enter öffnet, Esc schließt und gibt den Fokus zurück. */
export function FileSearch({
  groups,
  trees,
  query,
  onQuery,
  onActivate,
  focusRequest,
  focusDone,
  onFocusHandled,
  onSelect,
}: FileSearchProps): ReactElement {
  const [isOpen, setOpen] = useState<boolean>(false);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const listId: string = useId();

  const outcome: SearchOutcome = useMemo(
    () => (isOpen ? searchFiles(query, groups, trees) : NO_OUTCOME),
    [isOpen, query, groups, trees],
  );
  const { hits } = outcome;
  const active: number = Math.min(activeIndex, hits.length - 1);
  const isMultiGroup: boolean = groups.length > 1;
  const hasQuery: boolean = query.trim() !== '';

  // Strg P: Fokus setzen und den Inhalt markieren. Das Fokus-Ereignis öffnet die Liste.
  useEffect(() => {
    if (focusRequest === focusDone) {
      return;
    }
    inputRef.current?.focus();
    inputRef.current?.select();
    onFocusHandled();
  }, [focusRequest, focusDone, onFocusHandled]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    function handlePointerDown(event: PointerEvent): void {
      const target: EventTarget | null = event.target;
      if (target instanceof Node && rootRef.current?.contains(target) !== true) {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return (): void => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && active >= 0) {
      document.getElementById(`${listId}-${String(active)}`)?.scrollIntoView({ block: 'nearest' });
    }
  }, [isOpen, active, listId]);

  function handleFocus(event: FocusEvent<HTMLInputElement>): void {
    const previous: EventTarget | null = event.relatedTarget;
    if (previous instanceof HTMLElement) {
      returnFocusRef.current = previous;
    }
    setOpen(true);
    onActivate();
  }

  function close(): void {
    setOpen(false);
    const target: HTMLElement | null = returnFocusRef.current;
    if (target?.isConnected === true) {
      target.focus();
    } else {
      inputRef.current?.blur();
    }
  }

  function choose(hit: SearchHit): void {
    setOpen(false);
    inputRef.current?.blur();
    onSelect(hit);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      const step: number = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex(Math.max(0, Math.min(hits.length - 1, active + step)));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const hit: SearchHit | undefined = hits[active];
      if (isOpen && hit !== undefined) {
        choose(hit);
      }
    } else if (event.key === 'Escape' && isOpen) {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  }

  function renderHit(hit: SearchHit, index: number): ReactElement {
    const { dir, name } = lastSegment(hit.path);
    const groupName: string =
      groups.find((group: RepoGroup) => group.group === hit.group)?.name ?? '';
    const location: string = isMultiGroup && groupName !== '' ? `${groupName} · ${dir}` : dir;
    const isActive: boolean = index === active;
    return (
      <div
        key={`${hit.group}|${hit.path}`}
        id={`${listId}-${String(index)}`}
        role="option"
        tabIndex={-1}
        aria-selected={isActive}
        className={`file-search__hit${isActive ? ' file-search__hit--active' : ''}`}
        title={isMultiGroup ? `${groupName}: ${hit.path}` : hit.path}
        // Der Klick darf dem Feld den Fokus nicht nehmen, bevor er die Datei wählt.
        onMouseDown={(event: MouseEvent<HTMLDivElement>): void => {
          event.preventDefault();
        }}
        onClick={(): void => {
          choose(hit);
        }}
        onPointerEnter={(): void => {
          setActiveIndex(index);
        }}
      >
        <FileTypeIcon path={hit.path} />
        <span className="file-search__name">{renderName(name, hit.nameMatch)}</span>
        <span className="file-search__dir">
          {'‎'}
          {location}
        </span>
        {hit.stat !== null && (
          <ChangeMarks
            added={hit.stat.added}
            deleted={hit.stat.deleted}
            kind={hit.stat.kind}
            binary={hit.stat.binary}
          />
        )}
      </div>
    );
  }

  function renderResults(): ReactElement {
    return (
      <div className="file-search__results">
        <div className="file-search__head">
          <span>
            {hasQuery
              ? `${formatCount(outcome.matchCount)} Treffer in ${formatCount(outcome.fileCount)} Dateien`
              : 'Zuletzt geändert'}
          </span>
          {isMultiGroup && <span>über alle Repositories</span>}
        </div>
        {outcome.pendingGroups > 0 && <p className="file-search__note">Dateien werden gelesen …</p>}
        <div id={listId} className="file-search__list" role="listbox" aria-label="Treffer">
          {hits.map(renderHit)}
        </div>
        {hits.length === 0 && outcome.pendingGroups === 0 && (
          <p className="file-search__empty">
            {hasQuery ? (
              <>
                <b>Keine Datei gefunden.</b> Gesucht wird im Dateinamen und im Pfad, nicht im
                Inhalt.
              </>
            ) : (
              'Keine geänderten Dateien. Tippen durchsucht alle Dateien.'
            )}
          </p>
        )}
        <div className="file-search__foot">
          <span>↑ ↓ wählen · Enter öffnen · Esc schließen · ohne ignorierte Dateien</span>
          {outcome.matchCount > hits.length && (
            <span>
              die ersten {formatCount(hits.length)} von {formatCount(outcome.matchCount)}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="file-search">
      <div className="file-search__field">
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
          <circle cx="6" cy="6" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <path
            d="M9.2 9.2 12.5 12.5"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={isOpen && active >= 0 ? `${listId}-${String(active)}` : undefined}
          aria-label="Datei suchen"
          title="Datei suchen (Strg P)"
          placeholder="Datei suchen"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onFocus={handleFocus}
          onChange={(event: ChangeEvent<HTMLInputElement>): void => {
            onQuery(event.target.value);
            setActiveIndex(0);
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
        />
        <kbd>Strg P</kbd>
      </div>
      {isOpen && renderResults()}
    </div>
  );
}
