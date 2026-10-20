import type { ReactElement } from 'react';
import { AccountRowView } from '@/features/account/AccountRowView';
import { useAccount } from '@/features/account/useAccount';

const ACCOUNT_INFO =
  'Das Konto, mit dem die Claude-Kommandozeile angemeldet ist. „Konto wechseln“ startet deren Anmeldung (claude auth login) in einem eigenen Fenster und im Browser; Schließen des Fensters bricht ab. Gilt für jeden Agenten, der danach startet.';

export function AccountRow(): ReactElement {
  const { status, login } = useAccount();
  return (
    <AccountRowView
      label="Claude-Konto"
      info={ACCOUNT_INFO}
      errorPrefix="Konto nicht lesbar"
      loginHint="Im Konsolenfenster und im Browser fortfahren."
      status={status}
      onLogin={login}
    />
  );
}
