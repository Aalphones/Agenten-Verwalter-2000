import type { ReactElement } from 'react';
import { SettingRow } from '@/features/settings/SettingRow';
import { useAccount } from '@/features/account/useAccount';
import type { AccountInfo } from '@/lib/bindings/AccountInfo';
import type { AccountStatus } from '@/lib/bindings/AccountStatus';
import { planLabel } from '@/lib/labels';
import './AccountRow.css';

const ACCOUNT_INFO =
  'Das Konto, mit dem die Claude-Kommandozeile angemeldet ist. „Konto wechseln“ startet deren Anmeldung (claude auth login) in einem eigenen Fenster und im Browser; Schließen des Fensters bricht ab. Gilt für jeden Agenten, der danach startet.';

export function AccountRow(): ReactElement {
  const { status, login } = useAccount();
  const isLoggingIn: boolean = status?.isLoggingIn === true;

  function renderInfo(info: AccountInfo): ReactElement {
    if (!info.loggedIn) {
      return <span className="account-row__plain">Nicht angemeldet</span>;
    }
    return (
      <span className="account-row__identity">
        <span className="account-row__email" title={info.orgName ?? undefined}>
          {info.email ?? 'Angemeldet'}
        </span>
        {info.plan !== null && (
          <span className="account-row__extra">Abo: {planLabel(info.plan)}</span>
        )}
      </span>
    );
  }

  function renderState(loaded: AccountStatus | null): ReactElement {
    if (loaded === null) {
      return <span className="account-row__plain">Lädt …</span>;
    }
    return (
      <>
        {loaded.info !== null && renderInfo(loaded.info)}
        {loaded.error !== null && (
          <span className="account-row__error">Konto nicht lesbar: {loaded.error}</span>
        )}
      </>
    );
  }

  function buttonLabel(): string {
    if (isLoggingIn) {
      return 'Anmeldung läuft …';
    }
    if (status?.info?.loggedIn === true) {
      return 'Konto wechseln';
    }
    return 'Anmelden';
  }

  return (
    <SettingRow label="Claude-Konto" info={ACCOUNT_INFO}>
      <div className="account-row">
        <div className="account-row__main">
          <span className="account-row__state">{renderState(status)}</span>
          <button
            type="button"
            className="settings-view__button"
            disabled={isLoggingIn}
            onClick={login}
          >
            {buttonLabel()}
          </button>
        </div>
        {isLoggingIn && (
          <p className="account-row__hint" role="status">
            Im Konsolenfenster und im Browser fortfahren.
          </p>
        )}
      </div>
    </SettingRow>
  );
}
