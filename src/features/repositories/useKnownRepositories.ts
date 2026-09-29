import { useCallback, useEffect, useState } from 'react';
import type { KnownRepository } from '@/lib/bindings/KnownRepository';
import { addRepository, listRepositories, removeRepository } from '@/lib/repositories';

interface KnownRepositories {
  repositories: KnownRepository[];
  isLoading: boolean;
  add: (path: string) => Promise<KnownRepository>;
  remove: (id: string) => Promise<void>;
}

export function useKnownRepositories(): KnownRepositories {
  const [repositories, setRepositories] = useState<KnownRepository[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const reload = useCallback(async (): Promise<void> => {
    try {
      setRepositories(await listRepositories());
    } catch (reason: unknown) {
      console.error('Repositories konnten nicht geladen werden', reason);
      setRepositories([]);
    }
  }, []);

  useEffect((): void => {
    listRepositories()
      .then(setRepositories)
      .catch((reason: unknown) => {
        console.error('Repositories konnten nicht geladen werden', reason);
      })
      .finally((): void => {
        setIsLoading(false);
      });
  }, []);

  const add = useCallback(
    async (path: string): Promise<KnownRepository> => {
      const repository: KnownRepository = await addRepository(path);
      await reload();
      return repository;
    },
    [reload],
  );

  const remove = useCallback(
    async (id: string): Promise<void> => {
      await removeRepository(id);
      await reload();
    },
    [reload],
  );

  return { repositories, isLoading, add, remove };
}
