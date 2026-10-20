import { useAccountSource, type AccountSource } from '@/features/account/useAccount';
import type { AccountStatus } from '@/lib/bindings/AccountStatus';
import {
  loadCodexAccount,
  onCodexAccountChanged,
  startCodexAccountLogin,
} from '@/lib/codexAccount';

const CODEX_SOURCE: AccountSource = {
  load: loadCodexAccount,
  startLogin: startCodexAccountLogin,
  onChanged: onCodexAccountChanged,
};

interface CodexAccountView {
  /** `null`, bis der erste Lesevorgang zurück ist. */
  status: AccountStatus | null;
  isLoading: boolean;
  login: () => void;
}

/** Das Konto von Codex: beim Einhängen gelesen, bei jedem `codex-account://changed` neu gelesen. */
export function useCodexAccount(): CodexAccountView {
  return useAccountSource(CODEX_SOURCE);
}
