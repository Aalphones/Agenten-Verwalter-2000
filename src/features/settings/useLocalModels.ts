import { useEffect, useState } from 'react';
import type { LocalModels } from '@/lib/bindings/LocalModels';
import { commandErrorText } from '@/lib/errors';
import { loadLocalModels } from '@/lib/settings';

interface LocalModelsState {
  models: LocalModels | null;
  isLoading: boolean;
  reload: () => void;
}

interface LoadResult {
  /** Welcher Abruf (Zählerstand) diese Antwort geliefert hat. */
  attempt: number;
  models: LocalModels;
}

/** Die Modelle aus LM Studio: geladen beim Einhängen, jedes Mal wenn `isEnabled` auf `true` wechselt
 *  und bei `reload()`. Solange `isEnabled` fehlt, wird LM Studio nicht angefragt. */
export function useLocalModels(isEnabled: boolean): LocalModelsState {
  const [attempt, setAttempt] = useState<number>(0);
  const [result, setResult] = useState<LoadResult | null>(null);

  useEffect(() => {
    if (!isEnabled) {
      return undefined;
    }
    // Nur die jüngste Antwort zählt: „Neu laden“ und ein Wechsel der Betriebsart überholen einen langsamen Abruf.
    let isCurrent = true;
    function finish(models: LocalModels): void {
      if (isCurrent) {
        setResult({ attempt, models });
      }
    }
    loadLocalModels()
      .then(finish)
      .catch((reason: unknown) => {
        finish({ baseUrl: '', models: [], error: commandErrorText(reason) });
      });
    return (): void => {
      isCurrent = false;
    };
  }, [isEnabled, attempt]);

  function reload(): void {
    setAttempt((current: number) => current + 1);
  }

  return {
    models: result?.models ?? null,
    isLoading: isEnabled && result?.attempt !== attempt,
    reload,
  };
}
