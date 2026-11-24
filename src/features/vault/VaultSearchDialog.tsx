import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent, ReactElement } from 'react';
import { Dialog } from '@/components/Dialog';
import { rowId, VaultHitRow } from '@/features/vault/VaultHitRow';
import { BookIcon, InfoIcon, SearchIcon } from '@/features/vault/VaultIcons';
import { VaultPreview } from '@/features/vault/VaultPreview';
import { useVaultSearch } from '@/features/vault/useVaultSearch';
import type { VaultSearch } from '@/features/vault/useVaultSearch';
import { useVaultStatus } from '@/features/vault/useVaultStatus';
import {
  ALL_SCOPE,
  buildSections,
  folderCounts,
  folderLabel,
  scopeFolder,
  scopeOfFolder,
  VAULT_GROUPS,
  visibleHits,
} from '@/features/vault/vaultGroups';
import type { VaultFolderCount, VaultSection } from '@/features/vault/vaultGroups';
import { statusText } from '@/features/vault/vaultTexts';
import type { VaultHit } from '@/lib/bindings/VaultHit';
import { commandErrorText } from '@/lib/errors';
import { openVaultPath } from '@/lib/vault';
import './VaultSearchDialog.css';

const TITLE_ID = 'vault-search-title';
const LIST_ID = 'vault-search-list';
const SEARCH_INFO =
  'Sucht in Titeln, Tags, Dateinamen und Texten. Wortanfänge genügen; mehrere Wörter müssen alle vorkommen.';
/** Unter dieser Fensterbreite öffnet die Vorschau als zweite Stufe. */
const DETAIL_BREAKPOINT = 1180;
const GROUP_ID: string = VAULT_GROUPS[0].id;

/** Die letzte Suche bleibt beim erneuten Öffnen im Feld stehen. */
let lastQuery = '';

interface VaultSearchDialogProps {
  onClose: () => void;
}

function fileName(path: string): string {
  return path.split('/').pop() ?? path;
}

/** Suchdialog des Developer Vault: Gruppen links, Liste in der Mitte, Vorschau rechts. */
export function VaultSearchDialog({ onClose }: VaultSearchDialogProps): ReactElement {
  const search: VaultSearch = useVaultSearch(lastQuery);
  const { status } = useVaultStatus();
  const [scope, setScope] = useState<string>(ALL_SCOPE);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [isDetail, setIsDetail] = useState<boolean>(false);
  const [isTipOpen, setIsTipOpen] = useState<boolean>(false);
  const [doneText, setDoneText] = useState<string>('');
  const [actionError, setActionError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasQuery: boolean = search.shownQuery.trim() !== '';
  const folders: VaultFolderCount[] = useMemo(() => folderCounts(search.hits), [search.hits]);
  // Eine Untergruppe, die es zu diesem Treffersatz nicht gibt, fällt auf „Alle“ zurück.
  const folder: string | null = scopeFolder(scope);
  const activeScope: string =
    folder !== null && !folders.some((entry: VaultFolderCount) => entry.folder === folder)
      ? ALL_SCOPE
      : scope;
  const sections: VaultSection[] = useMemo(
    () => buildSections(search.hits, activeScope, hasQuery),
    [search.hits, activeScope, hasQuery],
  );
  const visible: VaultHit[] = useMemo(() => visibleHits(sections), [sections]);
  const selected: VaultHit | null =
    visible.find((hit: VaultHit) => hit.path === selectedPath) ?? visible[0] ?? null;
  const selectedKey: string | null = selected?.path ?? null;

  useEffect(() => {
    lastQuery = search.query;
  }, [search.query]);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    if (selectedKey !== null) {
      document.getElementById(rowId(selectedKey))?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedKey]);

  function chooseScope(next: string): void {
    setScope(next);
    setSelectedPath(null);
    setIsDetail(false);
    inputRef.current?.focus();
  }

  function handleQueryChange(value: string): void {
    search.setQuery(value);
    setSelectedPath(null);
    setIsDetail(false);
    setDoneText('');
    setActionError(null);
  }

  function act(hit: VaultHit, reveal: boolean): void {
    setActionError(null);
    openVaultPath(hit.file, reveal)
      .then(() => {
        setDoneText(`${reveal ? 'Im Ordner gezeigt' : 'Geöffnet'}: ${fileName(hit.file)}`);
      })
      .catch((reason: unknown) => {
        console.error('Vault-Eintrag nicht geöffnet', reason);
        setDoneText('');
        setActionError(
          `„${fileName(hit.file)}“ ließ sich nicht öffnen: ${commandErrorText(reason)} In den Einstellungen „Neu einlesen“ wählen.`,
        );
      });
  }

  function select(hit: VaultHit): void {
    setSelectedPath(hit.path);
    setDoneText('');
    setActionError(null);
    if (window.innerWidth <= DETAIL_BREAKPOINT) {
      setIsDetail(true);
    }
    inputRef.current?.focus();
  }

  function move(step: number): void {
    if (visible.length === 0) {
      return;
    }
    const index: number = visible.findIndex((hit: VaultHit) => hit.path === selectedKey);
    const next: VaultHit | undefined = visible[(index + step + visible.length) % visible.length];
    if (next !== undefined) {
      setSelectedPath(next.path);
      setDoneText('');
    }
  }

  function handleClose(): void {
    if (isTipOpen) {
      setIsTipOpen(false);
    } else if (isDetail) {
      setIsDetail(false);
    } else {
      onClose();
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      move(event.key === 'ArrowDown' ? 1 : -1);
    } else if (event.key === 'Enter' && event.target === inputRef.current) {
      event.preventDefault();
      if (selected !== null) {
        act(selected, event.ctrlKey);
      }
    } else if (event.ctrlKey && !event.shiftKey && !event.altKey && /^[0-9]$/.test(event.key)) {
      event.preventDefault();
      const index: number = Number(event.key);
      if (index === 0) {
        chooseScope(ALL_SCOPE);
      } else if (index <= VAULT_GROUPS.length && search.hits.length > 0) {
        chooseScope(GROUP_ID);
      }
    } else if (
      event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey &&
      event.key.toLowerCase() === 'k'
    ) {
      event.preventDefault();
      inputRef.current?.select();
    }
  }

  const scopedCount: number =
    activeScope === ALL_SCOPE
      ? search.total
      : search.hits.filter((hit: VaultHit) => folder === null || hit.path.startsWith(`${folder}/`))
          .length;
  const isTruncated: boolean = search.hits.length < search.total;
  const footerCount: string =
    activeScope !== ALL_SCOPE && isTruncated ? `${String(scopedCount)}+` : String(scopedCount);
  const errorText: string | null = search.error ?? actionError;

  function renderList(): ReactElement | null {
    if (search.error !== null) {
      return null;
    }
    if (visible.length === 0) {
      if (search.isLoading) {
        return (
          <p className="vault-search__empty" role="status">
            Lädt …
          </p>
        );
      }
      const text: string =
        hasQuery || search.hits.length > 0 ? 'Nichts gefunden.' : 'Der Vault ist noch leer.';
      return <p className="vault-search__empty">{text}</p>;
    }
    return (
      <>
        {sections.map((section: VaultSection) => (
          <div key={section.key} className="vault-search__section">
            {(section.isRecent || section.label !== null) && (
              <div className="vault-search__section-head">
                {section.isRecent ? (
                  'Zuletzt geändert'
                ) : (
                  <>
                    <BookIcon size={12} />
                    <span className="vault-search__crumb-group">Wissen ›</span> {section.label}
                  </>
                )}
                {section.more > 0 && (
                  <button
                    type="button"
                    className="vault-search__more"
                    onClick={(): void => {
                      chooseScope(scopeOfFolder(section.key));
                    }}
                  >
                    alle {section.more} zeigen
                  </button>
                )}
              </div>
            )}
            <ul
              className="vault-search__rows"
              role="group"
              aria-label={section.label ?? 'Zuletzt geändert'}
            >
              {section.items.map((hit: VaultHit) => (
                <VaultHitRow
                  key={hit.path}
                  hit={hit}
                  query={search.shownQuery}
                  isSelected={hit.path === selectedKey}
                  onSelect={select}
                  onOpen={(opened: VaultHit): void => {
                    setSelectedPath(opened.path);
                    act(opened, false);
                  }}
                />
              ))}
            </ul>
          </div>
        ))}
      </>
    );
  }

  const allLabel: string = hasQuery ? 'Alle Treffer' : 'Überblick';

  return (
    <Dialog labelledBy={TITLE_ID} className="vault-search" onClose={handleClose}>
      <div
        className={`vault-search__root${isDetail ? ' vault-search__root--detail' : ''}`}
        onKeyDown={handleKeyDown}
      >
        <header className="vault-search__header">
          <h3 id={TITLE_ID} className="vault-search__title">
            Developer Vault
          </h3>
          <div className="vault-search__search">
            <span className="vault-search__search-icon">
              <SearchIcon />
            </span>
            <input
              ref={inputRef}
              type="search"
              role="combobox"
              aria-expanded="true"
              aria-controls={LIST_ID}
              aria-autocomplete="list"
              aria-activedescendant={selectedKey === null ? undefined : rowId(selectedKey)}
              className="vault-search__input"
              placeholder="Snippets, Notizen, Vorlagen durchsuchen"
              aria-label="Developer Vault durchsuchen"
              autoComplete="off"
              value={search.query}
              onChange={(event: ChangeEvent<HTMLInputElement>): void => {
                handleQueryChange(event.target.value);
              }}
            />
            {search.query !== '' && (
              <button
                type="button"
                className="vault-search__clear"
                aria-label="Suche leeren"
                onClick={(): void => {
                  handleQueryChange('');
                  inputRef.current?.focus();
                }}
              >
                ✕
              </button>
            )}
            <button
              type="button"
              className="vault-search__info"
              aria-label="Suchhilfe"
              aria-expanded={isTipOpen}
              onClick={(): void => {
                setIsTipOpen((open: boolean) => !open);
              }}
            >
              <InfoIcon />
            </button>
            {isTipOpen && <div className="vault-search__tip">{SEARCH_INFO}</div>}
          </div>
          <span className="vault-search__status">{status === null ? '' : statusText(status)}</span>
          <button
            type="button"
            className="vault-search__close"
            aria-label="Schließen"
            onClick={onClose}
          >
            ✕
          </button>
        </header>
        {errorText !== null && (
          <p className="vault-search__error" role="alert">
            <b>Fehler:</b> {errorText}
          </p>
        )}
        <div className="vault-search__chips" role="toolbar" aria-label="Gruppen">
          <button
            type="button"
            className="vault-search__chip"
            aria-pressed={activeScope === ALL_SCOPE}
            onClick={(): void => {
              chooseScope(ALL_SCOPE);
            }}
          >
            Alle <span className="vault-search__count">{search.total}</span>
          </button>
          {search.hits.length > 0 && (
            <button
              type="button"
              className="vault-search__chip"
              aria-pressed={activeScope !== ALL_SCOPE}
              onClick={(): void => {
                chooseScope(GROUP_ID);
              }}
            >
              <BookIcon size={13} />
              Wissen <span className="vault-search__count">{search.hits.length}</span>
            </button>
          )}
        </div>
        <div className="vault-search__body">
          <nav className="vault-search__nav" aria-label="Gruppen">
            <button
              type="button"
              className="vault-search__nav-all"
              aria-current={activeScope === ALL_SCOPE}
              onClick={(): void => {
                chooseScope(ALL_SCOPE);
              }}
            >
              {allLabel}
              <span className="vault-search__count">{search.total}</span>
            </button>
            {search.hits.length > 0 && (
              <div className="vault-search__nav-group">
                <button
                  type="button"
                  className="vault-search__nav-head"
                  aria-current={activeScope === GROUP_ID}
                  onClick={(): void => {
                    chooseScope(GROUP_ID);
                  }}
                >
                  <BookIcon size={13} />
                  Wissen
                  <span className="vault-search__count">{search.hits.length}</span>
                </button>
                <div className="vault-search__nav-subs">
                  {folders.map((entry: VaultFolderCount) => (
                    <button
                      key={entry.folder}
                      type="button"
                      className="vault-search__nav-item"
                      aria-current={activeScope === scopeOfFolder(entry.folder)}
                      onClick={(): void => {
                        chooseScope(scopeOfFolder(entry.folder));
                      }}
                    >
                      {folderLabel(entry.folder)}
                      <span className="vault-search__count">{entry.count}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </nav>
          <div id={LIST_ID} className="vault-search__list" role="listbox" aria-label="Einträge">
            {renderList()}
          </div>
          <section className="vault-search__preview" aria-label="Vorschau">
            <VaultPreview
              hit={selected}
              hasQuery={hasQuery}
              onBack={(): void => {
                setIsDetail(false);
              }}
              onAct={act}
            />
          </section>
        </div>
        <footer className="vault-search__footer">
          <span aria-live="polite">
            {search.isLoading || search.error !== null
              ? ''
              : `${String(visible.length)} von ${footerCount} ${hasQuery ? 'Treffern' : 'Einträgen'}`}
            {search.isScanning && ' · Index wird noch aufgebaut'}
          </span>
          {doneText !== '' && <span className="vault-search__done">{doneText}</span>}
          <span className="vault-search__keys">
            <kbd>↑</kbd> <kbd>↓</kbd> wählen · <kbd>Enter</kbd> öffnen · <kbd>Ctrl Enter</kbd> im
            Ordner · <kbd>Ctrl 0–{VAULT_GROUPS.length}</kbd> Gruppe · <kbd>Esc</kbd> schließen
          </span>
        </footer>
      </div>
    </Dialog>
  );
}
