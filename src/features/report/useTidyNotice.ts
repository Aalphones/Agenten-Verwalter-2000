import { useCallback, useEffect, useState } from 'react';
import { NOTICE_LIVE_TEXT, NOTICE_MS, phaseTidiedText } from '@/features/report/reportTexts';
import type { ReportPhase } from '@/lib/bindings/ReportPhase';
import type { ReportView } from '@/lib/bindings/ReportView';

export interface TidyNotice {
  implementationId: string;
  phaseKey: string;
  text: string;
}

interface Watched {
  report: ReportView | null;
  /** Phase → Beginn der Ordnung, die zuletzt lief. */
  tidyingSince: ReadonlyMap<string, number>;
  notice: TidyNotice | null;
}

/** Erfolgreich heißt: der Stand der Ordnung ist neuer als ihr Beginn. Ein Abbruch oder eine Phase ohne
 *  etwas zu ordnen lässt den alten Stand stehen. */
function isNewlyTidied(phase: ReportPhase, since: number): boolean {
  return phase.tidyError === null && phase.tidiedAt !== null && phase.tidiedAt >= since;
}

function watch(previous: Watched, report: ReportView): Watched {
  const tidyingSince = new Map<string, number>();
  let notice: TidyNotice | null =
    previous.notice?.implementationId === report.implementationId ? previous.notice : null;
  for (const phase of report.phases) {
    if (phase.tidyingSince !== null) {
      tidyingSince.set(phase.phaseId, phase.tidyingSince);
      continue;
    }
    const since: number | undefined = previous.tidyingSince.get(phase.phaseId);
    if (since !== undefined && isNewlyTidied(phase, since)) {
      notice = {
        implementationId: report.implementationId,
        phaseKey: phase.key,
        text: phase.state === 'running' ? NOTICE_LIVE_TEXT : phaseTidiedText(phase.key),
      };
    }
  }
  return { report, tidyingSince, notice };
}

export interface TidyNoticeState {
  notice: TidyNotice | null;
  dismiss: () => void;
}

/** Der Hinweis, dass eine Ordnung endete, während der Bericht offen ist; er verschwindet von selbst. */
export function useTidyNotice(report: ReportView | null): TidyNoticeState {
  const [watched, setWatched] = useState<Watched>({
    report: null,
    tidyingSince: new Map(),
    notice: null,
  });

  // Beim Zeichnen abgeleitet statt im Effekt: jede neue Fassung des Berichts wird einmal verglichen.
  if (report !== null && report !== watched.report) {
    setWatched(watch(watched, report));
  }

  const dismiss = useCallback((): void => {
    setWatched((current: Watched) => ({ ...current, notice: null }));
  }, []);
  const notice: TidyNotice | null =
    watched.notice?.implementationId === report?.implementationId ? watched.notice : null;

  useEffect(() => {
    if (notice === null) {
      return undefined;
    }
    const timer: number = window.setTimeout(dismiss, NOTICE_MS);
    return (): void => {
      window.clearTimeout(timer);
    };
  }, [notice, dismiss]);

  return { notice, dismiss };
}
