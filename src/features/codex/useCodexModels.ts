import { useEffect, useState } from 'react';
import type { CodexModels } from '@/lib/bindings/CodexModels';
import { loadCodexModels } from '@/lib/codex';
import { commandErrorText } from '@/lib/errors';

interface LoadResult {
  /** Welcher Abruf diese Antwort geliefert hat. */
  attempt: number;
  models: CodexModels;
}

interface CodexModelsState {
  models: CodexModels | null;
  isLoading: boolean;
  reload: () => void;
}

/** Die Modelle von Codex: geladen, jedes Mal wenn `isEnabled` auf `true` wechselt und bei
 *  `reload()`. Solange `isEnabled` fehlt, wird Codex nicht gestartet. */
export function useCodexModels(isEnabled: boolean): CodexModelsState {
  const [attempt, setAttempt] = useState<number>(0);
  const [result, setResult] = useState<LoadResult | null>(null);

  useEffect(() => {
    if (!isEnabled) {
      return undefined;
    }
    // Nur die jüngste Antwort zählt: ein Wechsel der Betriebsart überholt einen langsamen Abruf.
    let isCurrent = true;
    function finish(models: CodexModels): void {
      if (isCurrent) {
        setResult({ attempt, models });
      }
    }
    loadCodexModels()
      .then(finish)
      .catch((reason: unknown) => {
        finish({ models: [], error: commandErrorText(reason) });
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
