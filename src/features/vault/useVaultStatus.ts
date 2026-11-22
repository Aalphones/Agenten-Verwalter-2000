import { useEffect, useState } from 'react';
import type { VaultStatus } from '@/lib/bindings/VaultStatus';
import { commandErrorText } from '@/lib/errors';
import { loadVaultStatus, onVaultChanged } from '@/lib/vault';

interface VaultStatusResult {
  /** `null`, bis der erste Stand da ist. */
  status: VaultStatus | null;
  error: string | null;
}

/** Lädt den Stand einmal und folgt `vault://changed`. */
export function useVaultStatus(): VaultStatusResult {
  const [status, setStatus] = useState<VaultStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    loadVaultStatus()
      .then((loaded: VaultStatus) => {
        if (isActive) {
          setStatus(loaded);
          setError(null);
        }
      })
      .catch((reason: unknown) => {
        console.error('Vault-Stand nicht lesbar', reason);
        if (isActive) {
          setError(`Vault-Stand nicht lesbar: ${commandErrorText(reason)}`);
        }
      });
    const unlisten = onVaultChanged((changed: VaultStatus) => {
      if (isActive) {
        setStatus(changed);
        setError(null);
      }
    });
    return (): void => {
      isActive = false;
      unlisten
        .then((stop: () => void) => {
          stop();
        })
        .catch(() => undefined);
    };
  }, []);

  return { status, error };
}
