import { open } from '@tauri-apps/plugin-dialog';
import { useState } from 'react';
import type { ReactElement } from 'react';
import { SettingRow } from '@/features/settings/SettingRow';
import { useVaultStatus } from '@/features/vault/useVaultStatus';
import type { VaultStatus } from '@/lib/bindings/VaultStatus';
import { commandErrorText } from '@/lib/errors';
import './VaultRows.css';

interface VaultDirRowProps {
  vaultDir: string | null;
  /** `true`, wenn gespeichert wurde. */
  onSave: (value: string | null) => Promise<boolean>;
}

export function VaultDirRow({ vaultDir, onSave }: VaultDirRowProps): ReactElement {
  const { status } = useVaultStatus();
  const [pickError, setPickError] = useState<string | null>(null);

  function pick(): void {
    setPickError(null);
    open({ directory: true, multiple: false, title: 'Vault-Ordner wählen' })
      .then((path: string | null) => {
        if (path !== null) {
          onSave(path).catch(() => undefined);
        }
      })
      .catch((reason: unknown) => {
        console.error('Ordnerauswahl nicht geöffnet', reason);
        setPickError(`Ordnerauswahl nicht geöffnet: ${commandErrorText(reason)}`);
      });
  }

  function renderValue(): ReactElement {
    if (vaultDir === null) {
      return (
        <>
          <span className="vault-row__muted">Kein Vault-Ordner</span>
          <button type="button" className="settings-view__button" onClick={pick}>
            Wählen …
          </button>
        </>
      );
    }
    return (
      <>
        <span className="vault-row__mono" title={vaultDir}>
          {vaultDir}
        </span>
        <button type="button" className="settings-view__button" onClick={pick}>
          Ändern …
        </button>
        <button
          type="button"
          className="settings-view__button"
          onClick={(): void => {
            onSave(null).catch(() => undefined);
          }}
        >
          Entfernen
        </button>
      </>
    );
  }

  const dirError: string | null = vaultDir === null ? null : problemText(status);
  return (
    <SettingRow id="vaultDir">
      <div className="vault-row__stack">
        <div className="vault-row__line">{renderValue()}</div>
        {dirError !== null && <span className="vault-row__warn">{dirError}</span>}
        {pickError !== null && <span className="vault-row__warn">{pickError}</span>}
      </div>
    </SettingRow>
  );
}

function problemText(status: VaultStatus | null): string | null {
  if (status === null || (status.state !== 'missing' && status.state !== 'error')) {
    return null;
  }
  return status.message;
}
