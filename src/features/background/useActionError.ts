import { useCallback, useState } from 'react';
import { commandErrorText } from '@/lib/errors';

interface Failure {
  scopeKey: string | null;
  message: string;
}

export interface ActionError {
  /** Fehler der letzten Aktion für den aktuellen Eintrag; `null` ohne. */
  error: string | null;
  run: (action: () => Promise<void>) => void;
}

/** Führt Aktionen eines Eintrags aus und hält deren Fehler; ein Fehler gilt nur für den Eintrag `scopeKey`,
 *  bei dem er entstand. */
export function useActionError(scopeKey: string | null): ActionError {
  const [failure, setFailure] = useState<Failure | null>(null);

  const run = useCallback(
    (action: () => Promise<void>): void => {
      setFailure(null);
      action().catch((reason: unknown) => {
        setFailure({ scopeKey, message: commandErrorText(reason) });
      });
    },
    [scopeKey],
  );

  const error: string | null =
    failure !== null && failure.scopeKey === scopeKey ? failure.message : null;
  return { error, run };
}
