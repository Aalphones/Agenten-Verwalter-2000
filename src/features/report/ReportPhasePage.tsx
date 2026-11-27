import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { ReportChecks } from '@/features/report/ReportChecks';
import { FIGURE_DRAWN_EVENT } from '@/features/report/ReportDiagram';
import { ReportReviewSection } from '@/features/report/ReportReviewSection';
import { ReportScreens } from '@/features/report/ReportScreens';
import { ReportStop } from '@/features/report/ReportStop';
import { ReportTidyHint } from '@/features/report/ReportTidyHint';
import { ReportWay } from '@/features/report/ReportWay';
import { ReportPhaseKeyContext } from '@/features/report/reportCommentsContext';
import { scopeOf, stopByIndex } from '@/features/report/reportDigest';
import {
  NEXT_LABEL,
  NO_RESULT_TEXT,
  PREVIOUS_LABEL,
  RUNNING_BANNER_TEXT,
  RUNNING_BANNER_TITLE,
  phaseHeading,
} from '@/features/report/reportTexts';
import type { ReportPhase } from '@/lib/bindings/ReportPhase';
import type { ReportStop as ReportStopData } from '@/lib/bindings/ReportStop';
import { formatCount } from '@/features/changes/changesScope';
import { useReportStore, type ReportFocus } from '@/stores/report';
import './ReportPhasePage.css';

/** Wie lange der Titel eines angesprungenen Stopps hervorgehoben bleibt, in ms. */
const FLASH_MS = 1600;

export interface ReportPageLink {
  /** Schlüssel der Phase; `null` ist der Überblick. */
  key: string | null;
  title: string;
}

interface ReportPhasePageProps {
  implementationId: string;
  phase: ReportPhase;
  previous: ReportPageLink | null;
  next: ReportPageLink | null;
  hasMargin: boolean;
  onShowPage: (key: string | null) => void;
  onOpenFile: (repositoryKey: string, path: string, line: number | null) => void;
}

/** Die Seite einer Phase: Ergebnis, Prüfzeile, Weg, Sichtabnahme, Review, dann die Stopps mit ihrem Code. */
export function ReportPhasePage({
  implementationId,
  phase,
  previous,
  next,
  hasMargin,
  onShowPage,
  onOpenFile,
}: ReportPhasePageProps): ReactElement {
  const [flashIndex, setFlashIndex] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const flashTimer = useRef<number | null>(null);
  /** Der angesprungene Stopp, solange der Sprung gilt: ein fertig gezeichnetes Schaubild darüber schiebt ihn weg. */
  const settlingTarget = useRef<HTMLElement | null>(null);
  const scope: string = scopeOf(implementationId, phase.phaseId);
  const focus: ReportFocus | null = useReportStore((state) => state.focus);
  const jumpToStop = useReportStore((state) => state.jumpToStop);
  const clearFocus = useReportStore((state) => state.clearFocus);
  const markVisited = useReportStore((state) => state.markVisited);
  const isRunning: boolean = phase.state === 'running';

  useEffect(() => {
    if (phase.state === 'done') {
      markVisited(implementationId, phase.phaseId);
    }
  }, [implementationId, phase.phaseId, phase.state, markVisited]);

  // Sprung auf einen Stopp dieser Seite: oben zeigen und kurz hervorheben. Ein zweites Mal nach dem nächsten Bild,
  // weil die Randnotizen der Code-Blöcke ihre Höhe erst beim Messen bekommen.
  useEffect(() => {
    if (
      focus === null ||
      focus.implementationId !== implementationId ||
      focus.phaseKey !== phase.key
    ) {
      return undefined;
    }
    const target: HTMLElement | null =
      rootRef.current?.querySelector<HTMLElement>(`[data-stop="${String(focus.stopIndex)}"]`) ??
      null;
    if (target === null) {
      clearFocus();
      return undefined;
    }
    target.scrollIntoView({ block: 'start' });
    setFlashIndex(focus.stopIndex);
    window.requestAnimationFrame(() => {
      target.scrollIntoView({ block: 'start' });
    });
    settlingTarget.current = target;
    if (flashTimer.current !== null) {
      window.clearTimeout(flashTimer.current);
    }
    flashTimer.current = window.setTimeout(() => {
      setFlashIndex(null);
      settlingTarget.current = null;
    }, FLASH_MS);
    // Der Sprung ist erledigt; die Aufräumfunktion dieses Effekts darf den Timer nicht mitnehmen.
    clearFocus();
    return undefined;
  }, [focus, implementationId, phase.key, clearFocus]);

  // Ein Schaubild, das beim Scrollen zum Stopp erst gezeichnet wird, verschiebt die Seite: erneut zum Stopp.
  useEffect(() => {
    const root: HTMLDivElement | null = rootRef.current;
    if (root === null) {
      return undefined;
    }
    function scrollToSettlingTarget(): void {
      settlingTarget.current?.scrollIntoView({ block: 'start' });
    }
    root.addEventListener(FIGURE_DRAWN_EVENT, scrollToSettlingTarget);
    return (): void => {
      root.removeEventListener(FIGURE_DRAWN_EVENT, scrollToSettlingTarget);
    };
  }, []);

  useEffect(
    () => (): void => {
      if (flashTimer.current !== null) {
        window.clearTimeout(flashTimer.current);
      }
    },
    [],
  );

  function jumpTo(index: number): void {
    jumpToStop({ implementationId, phaseKey: phase.key, stopIndex: index });
  }

  function hasStop(index: number): boolean {
    return stopByIndex(phase, index) !== undefined;
  }

  function renderResult(): ReactElement {
    if (isRunning) {
      return (
        <div className="report-phase__banner">
          <b>{RUNNING_BANNER_TITLE}</b>
          <span>{RUNNING_BANNER_TEXT}</span>
        </div>
      );
    }
    return (
      <>
        <p className="report-phase__lead">{phase.result ?? NO_RESULT_TEXT}</p>
        {phase.checks !== null && (
          <ReportChecks
            checks={phase.checks}
            phase={phase}
            onJumpToStop={jumpTo}
            onOpenFile={onOpenFile}
          />
        )}
        <ReportWay way={phase.way} hasStop={hasStop} onJumpToStop={jumpTo} />
      </>
    );
  }

  function renderFooter(): ReactElement {
    return (
      <footer className="report-phase__foot">
        {previous === null ? (
          <span />
        ) : (
          <button
            type="button"
            className="report-phase__nav"
            onClick={(): void => {
              onShowPage(previous.key);
            }}
          >
            <small>{PREVIOUS_LABEL}</small>
            <span>{previous.title}</span>
          </button>
        )}
        {next === null ? (
          <span />
        ) : (
          <button
            type="button"
            className="report-phase__nav report-phase__nav--next"
            onClick={(): void => {
              onShowPage(next.key);
            }}
          >
            <small>{NEXT_LABEL}</small>
            <span>{next.title}</span>
          </button>
        )}
      </footer>
    );
  }

  return (
    <ReportPhaseKeyContext.Provider value={phase.key}>
      <div ref={rootRef} className="report-phase">
        <p className="report-phase__kicker">{phaseHeading(phase)}</p>
        <h2 className="report-phase__title">{phase.title}</h2>
        <p className="report-phase__meta">
          <span>{formatCount(phase.files)} Dateien</span>
          <span>
            +{formatCount(phase.added)} −{formatCount(phase.removed)}
          </span>
          {phase.commits.length > 0 && <code>{phase.commits.join(' · ')}</code>}
        </p>
        {phase.tidyError !== null && (
          <ReportTidyHint
            phaseId={phase.phaseId}
            message={phase.tidyError}
            needsConfirm={phase.checks !== null}
          />
        )}
        {renderResult()}
        {phase.screens.length > 0 && <ReportScreens scope={scope} screens={phase.screens} />}
        {phase.review !== null && (
          <ReportReviewSection
            scope={scope}
            review={phase.review}
            hasStop={hasStop}
            onJumpToStop={jumpTo}
            onOpenFile={onOpenFile}
          />
        )}
        {phase.stops.map((stop: ReportStopData) => (
          <ReportStop
            key={stop.index}
            scope={scope}
            stop={stop}
            isFlashing={flashIndex === stop.index}
            hasMargin={hasMargin}
            onOpenFile={onOpenFile}
          />
        ))}
        {renderFooter()}
      </div>
    </ReportPhaseKeyContext.Provider>
  );
}
