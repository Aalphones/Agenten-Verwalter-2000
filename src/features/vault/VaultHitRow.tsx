import type { ReactElement } from 'react';
import { HighlightedText } from '@/features/vault/HighlightedText';
import { KindIcon } from '@/features/vault/VaultIcons';
import type { VaultHit } from '@/lib/bindings/VaultHit';

interface VaultHitRowProps {
  hit: VaultHit;
  query: string;
  isSelected: boolean;
  onSelect: (hit: VaultHit) => void;
  onOpen: (hit: VaultHit) => void;
}

export function rowId(path: string): string {
  return `vault-hit-${path}`;
}

/** Eine Zeile der Trefferliste: Symbol der Art, Titel, Beschreibung einzeilig. */
export function VaultHitRow({
  hit,
  query,
  isSelected,
  onSelect,
  onOpen,
}: VaultHitRowProps): ReactElement {
  return (
    <li
      id={rowId(hit.path)}
      role="option"
      aria-selected={isSelected}
      className={`vault-search__row${isSelected ? ' vault-search__row--selected' : ''}`}
      onClick={(): void => {
        onSelect(hit);
      }}
      onDoubleClick={(): void => {
        onOpen(hit);
      }}
    >
      <KindIcon kind={hit.kind} />
      <span className="vault-search__row-title" title={hit.title}>
        <HighlightedText text={hit.title} query={query} />
      </span>
      {hit.description !== '' && (
        <span className="vault-search__row-desc">
          <HighlightedText text={hit.description} query={query} />
        </span>
      )}
    </li>
  );
}
