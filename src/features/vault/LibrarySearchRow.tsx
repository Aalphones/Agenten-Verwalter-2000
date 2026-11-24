import { useState } from 'react';
import type { ReactElement } from 'react';
import { Switch } from '@/components/Switch';
import { SettingRow } from '@/features/settings/SettingRow';
import { useVaultStatus } from '@/features/vault/useVaultStatus';
import { statusText } from '@/features/vault/vaultTexts';
import { commandErrorText } from '@/lib/errors';
import { createVaultSkeleton, rescanVault } from '@/lib/vault';
import './VaultRows.css';

interface LibrarySearchRowProps {
  isEnabled: boolean;
  onToggle: (checked: boolean) => void;
}

export function LibrarySearchRow({ isEnabled, onToggle }: LibrarySearchRowProps): ReactElement {
  const { status, error } = useVaultStatus();
  const [skeletonError, setSkeletonError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  function createSkeleton(): void {
    setSkeletonError(null);
    setIsCreating(true);
    createVaultSkeleton()
      .catch((reason: unknown) => {
        console.error('Grundgerüst nicht angelegt', reason);
        setSkeletonError(`Grundgerüst nicht angelegt: ${commandErrorText(reason)}`);
      })
      .finally(() => {
        setIsCreating(false);
      });
  }

  function rescan(): void {
    setSkeletonError(null);
    rescanVault().catch((reason: unknown) => {
      console.error('Vault nicht neu eingelesen', reason);
      setSkeletonError(`Neu einlesen nicht möglich: ${commandErrorText(reason)}`);
    });
  }

  const isScanning: boolean = status?.state === 'scanning';
  const canRescan: boolean = status?.state === 'ready' || isScanning;
  const canCreateSkeleton: boolean =
    status !== null && status.canCreateSkeleton && status.state === 'ready';

  function renderEnabled(): ReactElement {
    return (
      <>
        <span className="vault-row__text">{status === null ? '…' : statusText(status)}</span>
        {canRescan && (
          <button
            type="button"
            className="settings-view__button"
            disabled={isScanning}
            onClick={rescan}
          >
            Neu einlesen
          </button>
        )}
        {canCreateSkeleton && (
          <button
            type="button"
            className="settings-view__button"
            disabled={isCreating}
            onClick={createSkeleton}
          >
            Grundgerüst anlegen
          </button>
        )}
      </>
    );
  }

  return (
    <SettingRow id="vaultEnabled">
      <div className="vault-row__stack">
        <div className="vault-row__line">
          <Switch checked={isEnabled} label="Suche" onChange={onToggle} />
          {isEnabled ? (
            renderEnabled()
          ) : (
            <span className="vault-row__muted">aus · kein Einstieg, Ctrl K ohne Wirkung</span>
          )}
        </div>
        {isEnabled && error !== null && <span className="vault-row__warn">{error}</span>}
        {skeletonError !== null && <span className="vault-row__warn">{skeletonError}</span>}
      </div>
    </SettingRow>
  );
}
