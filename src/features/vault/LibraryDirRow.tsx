import { open } from '@tauri-apps/plugin-dialog';
import { useState } from 'react';
import type { ReactElement } from 'react';
import { useEnvironment } from '@/features/environment/useEnvironment';
import { SettingRow } from '@/features/settings/SettingRow';
import { useVaultStatus } from '@/features/vault/useVaultStatus';
import type { VaultStatus } from '@/lib/bindings/VaultStatus';
import { commandErrorText } from '@/lib/errors';
import './VaultRows.css';

interface LibraryDirRowProps {
  libraryDir: string | null;
  /** `true`, wenn gespeichert wurde. */
  onSave: (value: string | null) => Promise<boolean>;
}

export function LibraryDirRow({ libraryDir, onSave }: LibraryDirRowProps): ReactElement {
  const { status } = useVaultStatus();
  const { check } = useEnvironment();
  const [pickError, setPickError] = useState<string | null>(null);

  function saveAndCheck(value: string | null): void {
    onSave(value)
      .then((isSaved: boolean) => {
        if (isSaved) {
          check();
        }
      })
      .catch(() => undefined);
  }

  function pick(): void {
    setPickError(null);
    open({ directory: true, multiple: false, title: 'Ordner der Bibliothek wählen' })
      .then((path: string | null) => {
        if (path !== null) {
          saveAndCheck(path);
        }
      })
      .catch((reason: unknown) => {
        console.error('Ordnerauswahl nicht geöffnet', reason);
        setPickError(`Ordnerauswahl nicht geöffnet: ${commandErrorText(reason)}`);
      });
  }

  function renderValue(): ReactElement {
    if (libraryDir === null) {
      return (
        <>
          <span className="vault-row__muted">Kein Ordner</span>
          <button type="button" className="settings-view__button" onClick={pick}>
            Wählen …
          </button>
        </>
      );
    }
    return (
      <>
        <span className="vault-row__mono" title={libraryDir}>
          {libraryDir}
        </span>
        <button type="button" className="settings-view__button" onClick={pick}>
          Ändern …
        </button>
        <button
          type="button"
          className="settings-view__button"
          onClick={(): void => {
            saveAndCheck(null);
          }}
        >
          Entfernen
        </button>
      </>
    );
  }

  const dirError: string | null = libraryDir === null ? null : problemText(status);
  return (
    <SettingRow id="libraryDir">
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
