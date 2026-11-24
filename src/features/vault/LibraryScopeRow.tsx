import type { ReactElement } from 'react';
import { SettingRow } from '@/features/settings/SettingRow';
import { useVaultStatus } from '@/features/vault/useVaultStatus';
import './VaultRows.css';

/** Was bei einer Bibliothek durchsucht wird (ADR 069). */
const LIBRARY_SCOPE_TEXT =
  'CLAUDE.md · AGENTS.md · skills/ · commands/ · output-styles/ · memory/ · _vault/';

export function LibraryScopeRow(): ReactElement {
  const { status } = useVaultStatus();
  return (
    <SettingRow id="libraryScope">
      {status?.layout === 'library' && (
        <span className="vault-row__mono">{LIBRARY_SCOPE_TEXT}</span>
      )}
      {status?.layout === 'plain' && <span className="vault-row__text">der ganze Ordner</span>}
    </SettingRow>
  );
}
