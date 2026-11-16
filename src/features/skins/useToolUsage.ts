import { useEffect, useState } from 'react';
import type { ToolUsage } from '@/lib/bindings/ToolUsage';
import { getToolUsage } from '@/lib/skins';

/** Zeitraum, aus dem „Trifft in deinen letzten Sessions“ seine Aufrufe nimmt. */
const USAGE_DAYS = 30;

interface ToolUsageState {
  /** `null`, solange sie lädt oder nicht ladbar war. */
  usage: ToolUsage[] | null;
  isFailed: boolean;
}

/** Die häufigsten Werkzeug-Aufrufe der letzten Sessions; einmal je Aufrufer geladen. */
export function useToolUsage(): ToolUsageState {
  const [usage, setUsage] = useState<ToolUsage[] | null>(null);
  const [isFailed, setIsFailed] = useState<boolean>(false);

  useEffect(() => {
    const controller = new AbortController();
    getToolUsage(USAGE_DAYS)
      .then((list: ToolUsage[]) => {
        if (!controller.signal.aborted) {
          setUsage(list);
        }
      })
      .catch((reason: unknown) => {
        console.error('Werkzeug-Nutzung nicht ladbar', reason);
        if (!controller.signal.aborted) {
          setIsFailed(true);
        }
      });
    return (): void => {
      controller.abort();
    };
  }, []);

  return { usage, isFailed };
}
