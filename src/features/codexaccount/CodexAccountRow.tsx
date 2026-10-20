import type { ReactElement } from 'react';
import { AccountRowView } from '@/features/account/AccountRowView';
import { useCodexAccount } from '@/features/codexaccount/useCodexAccount';

const CODEX_ACCOUNT_INFO =
  'Meldet Codex mit deinem ChatGPT-Konto an; gilt für alle Codex-Sessions ab der nächsten Nachricht.';

export function CodexAccountRow(): ReactElement {
  const { status, login } = useCodexAccount();
  return (
    <AccountRowView
      label="Codex-Konto"
      info={CODEX_ACCOUNT_INFO}
      errorPrefix="Codex-Konto"
      loginHint="Im Browser fortfahren."
      status={status}
      onLogin={login}
    />
  );
}
