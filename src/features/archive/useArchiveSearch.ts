import { useCallback, useEffect, useRef, useState } from 'react';
import type { ArchivePage } from '@/lib/bindings/ArchivePage';
import type { ArchivedProject } from '@/lib/bindings/ArchivedProject';
import { searchArchive } from '@/lib/archive';
import { commandErrorText } from '@/lib/errors';

const DEBOUNCE_MS = 250;

export interface ArchiveSearch {
  query: string;
  setQuery: (query: string) => void;
  /** Die Karten der bisher geladenen Seiten, in der Reihenfolge des Cores. */
  items: ArchivedProject[];
  hasMore: boolean;
  isLoading: boolean;
  /** Der Begriff, zu dem `items` gehören — hinkt `query` während des Entprellens und Ladens hinterher. */
  shownQuery: string;
  /** Satz zum Such- oder Nachladefehler; `null` ohne Fehler. */
  error: string | null;
  loadMore: () => void;
  /** Nimmt ein Vorhaben aus der Liste — für wiederhergestellte. */
  removeItem: (projectId: string) => void;
}

/** Sucht im Archiv, entprellt und seitenweise. Eine Antwort, die nach einer neueren Anfrage eintrifft, wird verworfen. */
export function useArchiveSearch(): ArchiveSearch {
  const [query, setQuery] = useState<string>('');
  const [shownQuery, setShownQuery] = useState<string>('');
  const [items, setItems] = useState<ArchivedProject[]>([]);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const latestRequestRef = useRef<number>(0);
  const shownQueryRef = useRef<string>('');

  useEffect(() => {
    // Der leere Begriff ist der Dialog-Start und das Löschen des Feldes — dort wartet niemand auf eine Tipp-Pause.
    const delay: number = query.trim() === '' ? 0 : DEBOUNCE_MS;
    const timer = window.setTimeout((): void => {
      latestRequestRef.current += 1;
      const request: number = latestRequestRef.current;
      setIsLoading(true);
      setError(null);
      searchArchive(query, 0)
        .then((page: ArchivePage) => {
          if (request !== latestRequestRef.current) {
            return;
          }
          shownQueryRef.current = query;
          setShownQuery(query);
          setItems(page.items);
          setHasMore(page.hasMore);
          setIsLoading(false);
        })
        .catch((reason: unknown) => {
          console.error('Archiv nicht durchsuchbar', reason);
          if (request !== latestRequestRef.current) {
            return;
          }
          setError(`Archiv nicht durchsuchbar: ${commandErrorText(reason)}`);
          setIsLoading(false);
        });
    }, delay);
    return (): void => {
      window.clearTimeout(timer);
    };
  }, [query]);

  // Ein Ende der Komponente macht jede noch offene Antwort ungültig.
  useEffect(() => {
    return (): void => {
      latestRequestRef.current += 1;
    };
  }, []);

  const loadMore = useCallback((): void => {
    latestRequestRef.current += 1;
    const request: number = latestRequestRef.current;
    setIsLoading(true);
    setError(null);
    // Der Offset ist die aktuelle Kartenzahl: ein wiederhergestelltes Vorhaben fehlt auch in der Liste des Cores.
    searchArchive(shownQueryRef.current, items.length)
      .then((page: ArchivePage) => {
        if (request !== latestRequestRef.current) {
          return;
        }
        setItems((current: ArchivedProject[]) => {
          const knownIds = new Set<string>(
            current.map((candidate: ArchivedProject) => candidate.id),
          );
          return [
            ...current,
            ...page.items.filter((candidate: ArchivedProject) => !knownIds.has(candidate.id)),
          ];
        });
        setHasMore(page.hasMore);
        setIsLoading(false);
      })
      .catch((reason: unknown) => {
        console.error('Archiv nicht nachladbar', reason);
        if (request !== latestRequestRef.current) {
          return;
        }
        setError(`Weitere Vorhaben nicht ladbar: ${commandErrorText(reason)}`);
        setIsLoading(false);
      });
  }, [items.length]);

  const removeItem = useCallback((projectId: string): void => {
    setItems((current: ArchivedProject[]) =>
      current.filter((candidate: ArchivedProject) => candidate.id !== projectId),
    );
  }, []);

  return { query, setQuery, items, hasMore, isLoading, shownQuery, error, loadMore, removeItem };
}
