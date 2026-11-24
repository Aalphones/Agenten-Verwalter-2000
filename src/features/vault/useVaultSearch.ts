import { useEffect, useRef, useState } from 'react';
import type { VaultHit } from '@/lib/bindings/VaultHit';
import type { VaultSearchResult } from '@/lib/bindings/VaultSearchResult';
import { commandErrorText } from '@/lib/errors';
import { findInVault } from '@/lib/vault';

const DEBOUNCE_MS = 250;
export const SEARCH_LIMIT = 50;

export interface VaultSearch {
  query: string;
  setQuery: (query: string) => void;
  /** Der Begriff, zu dem `hits` gehören — hinkt `query` während des Entprellens und Ladens hinterher. */
  shownQuery: string;
  hits: VaultHit[];
  /** Zahl aller passenden Artefakte, unabhängig vom Limit. */
  total: number;
  isScanning: boolean;
  isLoading: boolean;
  /** Satz zum Suchfehler; `null` ohne Fehler. */
  error: string | null;
}

/** Sucht im Vault, entprellt. Das leere Feld lädt sofort die zuletzt geänderten Artefakte; eine Antwort,
 *  die nach einer neueren Anfrage eintrifft, wird verworfen. `initialQuery` ist die Suche vom letzten Öffnen. */
export function useVaultSearch(initialQuery: string): VaultSearch {
  const [query, setQuery] = useState<string>(initialQuery);
  const [shownQuery, setShownQuery] = useState<string>(initialQuery);
  const [hits, setHits] = useState<VaultHit[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const latestRequestRef = useRef<number>(0);

  useEffect(() => {
    // Der leere Begriff ist der Dialog-Start und das Löschen des Feldes — dort wartet niemand auf eine Tipp-Pause.
    const delay: number = query.trim() === '' ? 0 : DEBOUNCE_MS;
    const timer = window.setTimeout((): void => {
      latestRequestRef.current += 1;
      const request: number = latestRequestRef.current;
      setIsLoading(true);
      setError(null);
      findInVault({
        text: query,
        kind: null,
        tags: [],
        under: null,
        limit: SEARCH_LIMIT,
        anyTerm: false,
      })
        .then((result: VaultSearchResult) => {
          if (request !== latestRequestRef.current) {
            return;
          }
          setHits(result.hits);
          setTotal(result.total);
          setIsScanning(result.isScanning);
          setShownQuery(query);
          setIsLoading(false);
        })
        .catch((reason: unknown) => {
          if (request !== latestRequestRef.current) {
            return;
          }
          console.error('Vault-Suche fehlgeschlagen', reason);
          setHits([]);
          setTotal(0);
          setShownQuery(query);
          setError(`Die Suche ist fehlgeschlagen: ${commandErrorText(reason)}`);
          setIsLoading(false);
        });
    }, delay);
    return (): void => {
      window.clearTimeout(timer);
    };
  }, [query]);

  return { query, setQuery, shownQuery, hits, total, isScanning, isLoading, error };
}
