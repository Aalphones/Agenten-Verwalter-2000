import { useEffect, useLayoutEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { Dialog } from '@/components/Dialog';
import { implementationTitle } from '@/features/implementation/implementationTexts';
import { ReportBar } from '@/features/report/ReportBar';
import { ReportOverview } from '@/features/report/ReportOverview';
import { ReportPhasePage, type ReportPageLink } from '@/features/report/ReportPhasePage';
import { ReportToc } from '@/features/report/ReportToc';
import { barMeta, barState, pageOrder, phasesBegun } from '@/features/report/reportDigest';
import {
  EMPTY_TEXT,
  LOADING_TEXT,
  OVERVIEW_TITLE,
  TOC_SHEET_TITLE,
} from '@/features/report/reportTexts';
import { useReport, type ReportState } from '@/features/report/useReport';
import type { ImplementationView } from '@/lib/bindings/ImplementationView';
import type { ReportPhase } from '@/lib/bindings/ReportPhase';
import type { ReportView as ReportData } from '@/lib/bindings/ReportView';
import { isTextTarget } from '@/lib/keyTargets';
import { useFilesStore } from '@/stores/files';
import { useReportStore } from '@/stores/report';
import './ReportView.css';

/** Ab dieser Breite der Seite stehen die Notizen im Rand neben dem Code, darunter zwischen den Zeilen. */
const MARGIN_MIN_WIDTH = 940;
const NEXT_KEYS: readonly string[] = ['ArrowRight', 'j'];
const PREVIOUS_KEYS: readonly string[] = ['ArrowLeft', 'k'];
const TOC_TITLE_ID = 'report-toc-title';

interface ReportViewProps {
  implementation: ImplementationView;
  /** Schlüssel der Ansicht „Dateien“ des Hosts (Umsetzung oder Station-Session), in der „Im Reiter Dateien“ landet. */
  filesViewKey: string;
  /** Schaltet den Host auf den Reiter „Dateien“. */
  onOpenFiles: () => void;
}

/** Der Reiter „Review“: Leiste, Inhaltsverzeichnis und die offene Seite (Überblick oder Phase). */
export function ReportView({
  implementation,
  filesViewKey,
  onOpenFiles,
}: ReportViewProps): ReactElement {
  const implementationId: string = implementation.id;
  const [isTocOpen, setIsTocOpen] = useState<boolean>(false);
  const [hasMargin, setHasMargin] = useState<boolean>(false);
  const [pageElement, setPageElement] = useState<HTMLDivElement | null>(null);
  const { report, error }: ReportState = useReport(implementationId);
  const storedPage: string | null = useReportStore(
    (state) => state.pageByImplementation[implementationId] ?? null,
  );
  const showPageInStore = useReportStore((state) => state.showPage);
  const jumpToStop = useReportStore((state) => state.jumpToStop);
  const updateFiles = useFilesStore((state) => state.update);

  // Eine Phase, die es nicht (mehr) gibt oder noch nicht begonnen hat, fällt auf den Überblick zurück.
  const phase: ReportPhase | undefined =
    report === null || storedPage === null
      ? undefined
      : phasesBegun(report).find((candidate: ReportPhase) => candidate.key === storedPage);
  const page: string | null = phase === undefined ? null : phase.key;

  function showPage(key: string | null): void {
    showPageInStore(implementationId, key);
    setIsTocOpen(false);
  }

  function openFile(repositoryKey: string, path: string, line: number | null): void {
    updateFiles(filesViewKey, { pendingLink: { kind: 'view', key: repositoryKey, path, line } });
    onOpenFiles();
  }

  // Eine neue Seite beginnt oben; Neuladen des Berichts lässt sie stehen, weil sich `page` dabei nicht ändert.
  // Als Layout-Effekt, damit ein Sprung auf einen Stopp danach (Effekt der Seite) das letzte Wort hat.
  useLayoutEffect(() => {
    pageElement?.scrollTo({ top: 0, behavior: 'instant' });
  }, [page, pageElement]);

  useEffect(() => {
    if (pageElement === null) {
      return undefined;
    }
    function measure(): void {
      if (pageElement !== null) {
        setHasMargin(pageElement.clientWidth >= MARGIN_MIN_WIDTH);
      }
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(pageElement);
    return (): void => {
      observer.disconnect();
    };
  }, [pageElement]);

  useEffect(() => {
    if (report === null || isTocOpen) {
      return undefined;
    }
    const order: (string | null)[] = pageOrder(report);
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }
      if (isTextTarget(event.target)) {
        return;
      }
      const isNext: boolean = NEXT_KEYS.includes(event.key);
      const isPrevious: boolean = PREVIOUS_KEYS.includes(event.key);
      if (!isNext && !isPrevious) {
        return;
      }
      const step: number = isNext ? 1 : -1;
      const target: string | null | undefined = order[order.indexOf(page) + step];
      if (target === undefined) {
        return;
      }
      event.preventDefault();
      showPageInStore(implementationId, target);
    }
    window.addEventListener('keydown', handleKeyDown);
    return (): void => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [report, page, isTocOpen, implementationId, showPageInStore]);

  function linkOf(key: string | null, data: ReportData): ReportPageLink {
    if (key === null) {
      return { key: null, title: OVERVIEW_TITLE };
    }
    const title: string =
      data.phases.find((candidate: ReportPhase) => candidate.key === key)?.title ?? key;
    return { key, title: `${key} · ${title}` };
  }

  function renderPage(data: ReportData): ReactElement {
    if (phase === undefined) {
      return (
        <ReportOverview
          report={data}
          implementationTitle={implementationTitle(implementation)}
          onShowPage={showPage}
          onJumpToStop={(phaseKey: string, stopIndex: number): void => {
            jumpToStop({ implementationId, phaseKey, stopIndex });
          }}
        />
      );
    }
    const order: (string | null)[] = pageOrder(data);
    const position: number = order.indexOf(phase.key);
    const previousKey: string | null | undefined = order[position - 1];
    const nextKey: string | null | undefined = order[position + 1];
    return (
      <ReportPhasePage
        implementationId={implementationId}
        phase={phase}
        previous={previousKey === undefined ? null : linkOf(previousKey, data)}
        next={nextKey === undefined ? null : linkOf(nextKey, data)}
        hasMargin={hasMargin}
        onShowPage={showPage}
        onOpenFile={openFile}
      />
    );
  }

  if (report === null || phasesBegun(report).length === 0) {
    const text: string = report === null ? (error ?? LOADING_TEXT) : EMPTY_TEXT;
    return (
      <div className="report-view report-view--note">
        <p className="report-view__note">{text}</p>
      </div>
    );
  }

  return (
    <div className="report-view">
      <div className="report-view__grid">
        <ReportBar
          state={barState(report, implementation)}
          meta={barMeta(report, implementationTitle(implementation), implementation.phases.length)}
          onOpenToc={(): void => {
            setIsTocOpen(true);
          }}
        />
        <div className="report-view__toc">
          <ReportToc
            report={report}
            implementationId={implementationId}
            currentPage={page}
            onShowPage={showPage}
          />
        </div>
        <div ref={setPageElement} className="report-view__page">
          <div className="report-view__doc">{renderPage(report)}</div>
        </div>
      </div>
      {isTocOpen && (
        <Dialog
          labelledBy={TOC_TITLE_ID}
          className="report-view__sheet"
          onClose={(): void => {
            setIsTocOpen(false);
          }}
        >
          <h2 id={TOC_TITLE_ID} className="report-view__sheet-title">
            {TOC_SHEET_TITLE}
          </h2>
          <ReportToc
            report={report}
            implementationId={implementationId}
            currentPage={page}
            onShowPage={showPage}
          />
        </Dialog>
      )}
    </div>
  );
}
