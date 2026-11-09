import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { useNow } from '@/features/background/useNow';
import { countChangedFiles } from '@/features/changes/changesScope';
import { useSessionChanges } from '@/features/changes/useSessionChanges';
import { CardStack } from '@/features/implementation/CardStack';
import { ImplementationBar } from '@/features/implementation/ImplementationBar';
import { ImplementationHeader } from '@/features/implementation/ImplementationHeader';
import {
  autoFocus,
  flatStations,
  focusOrder,
  isFocusValid,
  openingPhase,
  type StationRef,
} from '@/features/implementation/implementationOrder';
import { ReportPanel } from '@/features/implementation/ReportPanel';
import { Timeline } from '@/features/implementation/Timeline';
import type { Effort } from '@/lib/bindings/Effort';
import type { ImplementationView as Implementation } from '@/lib/bindings/ImplementationView';
import type { ModelId } from '@/lib/bindings/ModelId';
import type { PhaseView } from '@/lib/bindings/PhaseView';
import type { SessionSummary } from '@/lib/bindings/SessionSummary';
import {
  applyImplementationCancel,
  applyImplementationChange,
  cancelImplementation,
  cancelStationCountdown,
  completeStationByUser,
  deleteImplementation,
  discardImplementationCancel,
  loadImplementationReport,
  setImplementationAutoStart,
  setImplementationStopAfterCurrent,
  setStationPlan,
  startStation,
} from '@/lib/implementation';
import { isTextTarget } from '@/lib/keyTargets';
import { setSessionEffort, setSessionModel } from '@/lib/sessions';
import { useActionError } from '@/lib/useActionError';
import { useImplementationStore } from '@/stores/implementation';
import { useSessionsStore, type ImplementationViewKind } from '@/stores/sessions';
import './ImplementationView.css';

interface ImplementationViewProps {
  implementation: Implementation;
  projectName: string;
  activeView: ImplementationViewKind;
  hasChanges: boolean;
  changesCount: number | null;
  /** Alle Sessions; die Kachel der Station im Fokus liest daraus die Changes ihrer Session. */
  sessions: readonly SessionSummary[];
  /** Inhalt des Reiters „Changes“ (Reichweite Vorhaben); gezeigt, wenn er aktiv ist. */
  changes: ReactNode;
  /** Artefakte aus Sessions der Umsetzung (Stationen und Rückfragen). */
  artifactCount: number;
  /** Inhalt des Reiters „Artefakte“; gezeigt, wenn er aktiv ist und es Artefakte gibt. */
  artifacts: ReactNode;
  /** Legt eine Rückfrage zur Umsetzung an und öffnet sie (`useInquiry`). */
  onNewInquiry: (implementationId: string) => Promise<void>;
  onShowView: (view: ImplementationViewKind) => void;
  onOpenProject: () => void;
  /** Laufende Terminals des Vorhabens. */
  terminalCount: number;
  isTerminalOpen: boolean;
  onToggleTerminal: () => void;
}

/** Schritt in der Stationsfolge für eine Taste; 0, wenn sie nicht blättert. */
function arrowStep(key: string): number {
  if (key === 'ArrowDown') {
    return 1;
  }
  return key === 'ArrowUp' ? -1 : 0;
}

/** Hauptfläche einer Umsetzung (ADR 048): Kopfzeile, darunter Zeitleiste mit Kartei oder die Changes. */
export function ImplementationView({
  implementation,
  projectName,
  activeView,
  hasChanges,
  changesCount,
  sessions,
  changes,
  artifactCount,
  artifacts,
  onNewInquiry,
  onShowView,
  onOpenProject,
  terminalCount,
  isTerminalOpen,
  onToggleTerminal,
}: ImplementationViewProps): ReactElement {
  // Text des geöffneten Lageberichts; `null`: das Fenster ist zu.
  const [report, setReport] = useState<string | null>(null);
  const [isReportBusy, setIsReportBusy] = useState<boolean>(false);
  const [isInquiryBusy, setIsInquiryBusy] = useState<boolean>(false);
  const timelineRef = useRef<HTMLDivElement>(null);
  const storedFocus: string | undefined = useImplementationStore(
    (state) => state.focused[implementation.id],
  );
  const setFocused = useImplementationStore((state) => state.setFocused);
  const clearFocused = useImplementationStore((state) => state.clearFocused);
  const selectSession = useSessionsStore((state) => state.selectSession);
  const showSessionView = useSessionsStore((state) => state.showView);
  const { error: actionError, run } = useActionError(implementation.id);

  const stations: StationRef[] = useMemo(() => flatStations(implementation), [implementation]);
  // Ohne Repository bzw. ohne Artefakt fällt der Reiter auf den Ablauf zurück.
  const isChangesShown: boolean = activeView === 'changes' && hasChanges;
  const isArtifactsShown: boolean = activeView === 'artifacts' && artifactCount > 0;
  const isFlow: boolean = !isChangesShown && !isArtifactsShown;
  const isTicking: boolean = stations.some((ref: StationRef) =>
    ['running', 'starting', 'waitsForScript', 'countdown'].includes(ref.station.state),
  );
  const now: number = useNow(isTicking);

  const automaticId: string | null = autoFocus(implementation);
  const order: string[] = useMemo(() => focusOrder(implementation), [implementation]);
  const isStoredValid: boolean =
    storedFocus !== undefined && isFocusValid(implementation, storedFocus);
  const focusedId: string | null =
    isStoredValid && storedFocus !== undefined ? storedFocus : automaticId;
  const isManualFocus: boolean = isStoredValid && storedFocus !== automaticId;
  const implementationId: string = implementation.id;

  // Die Kachel der Station im Fokus zählt nur die Changes ihrer eigenen Session (Reichweite Session).
  const focusedSessionId: string | null =
    stations.find((ref: StationRef) => ref.station.id === focusedId)?.station.sessionId ?? null;
  const focusedSession: SessionSummary | null =
    focusedSessionId === null
      ? null
      : (sessions.find((session: SessionSummary) => session.id === focusedSessionId) ?? null);
  const { changes: stationChanges } = useSessionChanges(focusedSession, 'session', isFlow);
  const stationChangesCount: number | null =
    stationChanges === null ? null : countChangedFiles(stationChanges);

  // Beim Öffnen steht die erste aktive Phase oben in der Zeitleiste. Im schmalen Layout rollt die
  // Zeitleiste nicht selbst, `scrollTop` bleibt dort wirkungslos.
  useLayoutEffect(() => {
    const phase: PhaseView | null = openingPhase(implementation);
    const container: HTMLDivElement | null = timelineRef.current;
    if (!isFlow || phase === null || container === null) {
      return;
    }
    const anchor: HTMLElement | null = container.querySelector<HTMLElement>(
      `[data-scroll-anchor="${CSS.escape(phase.id)}"]`,
    );
    if (anchor === null) {
      return;
    }
    container.scrollTop +=
      anchor.getBoundingClientRect().top - container.getBoundingClientRect().top;
    // Nur das Öffnen scrollt, nicht jede neue Fassung der Umsetzung.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [implementationId, isFlow]);

  useEffect(() => {
    if (!isFlow || focusedId === null) {
      return undefined;
    }
    const currentFocus: string = focusedId;
    function handleKeyDown(event: KeyboardEvent): void {
      const step: number = arrowStep(event.key);
      if (step === 0 || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }
      if (isTextTarget(event.target)) {
        return;
      }
      const position: number = order.indexOf(currentFocus);
      const target: string | undefined = order[position + step];
      if (position < 0 || target === undefined) {
        return;
      }
      event.preventDefault();
      setFocused(implementationId, target);
      // Nur die Pfeiltaste holt die Zeile ins Bild; Klick und automatischer Fokus lassen die Zeitleiste stehen.
      requestAnimationFrame((): void => {
        timelineRef.current
          ?.querySelector<HTMLElement>(`[data-focus-id="${CSS.escape(target)}"]`)
          ?.scrollIntoView({ block: 'nearest' });
      });
    }
    window.addEventListener('keydown', handleKeyDown);
    return (): void => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFlow, focusedId, order, implementationId, setFocused]);

  // Der Bericht wird gelesen, bevor das Fenster aufgeht; bis dahin dreht sich der Knopf.
  function openReport(): void {
    setIsReportBusy(true);
    run(
      () =>
        loadImplementationReport(implementationId)
          .then((text: string): void => {
            setReport(text);
          })
          .finally((): void => {
            setIsReportBusy(false);
          }),
      'Lagebericht nicht ladbar',
    );
  }

  function startInquiry(): void {
    setIsInquiryBusy(true);
    run(
      () =>
        onNewInquiry(implementationId).finally((): void => {
          setIsInquiryBusy(false);
        }),
      'Rückfrage nicht angelegt',
    );
  }

  function sessionIdOf(stationId: string): string | null {
    return (
      stations.find((ref: StationRef) => ref.station.id === stationId)?.station.sessionId ?? null
    );
  }

  function openChat(stationId: string): void {
    const sessionId: string | null = sessionIdOf(stationId);
    if (sessionId !== null) {
      selectSession(sessionId);
    }
  }

  // Die Changes einer Station öffnen sich in ihrer Session, nicht in der Reichweite des Vorhabens.
  function openStationChanges(stationId: string): void {
    const sessionId: string | null =
      stations.find((ref: StationRef) => ref.station.id === stationId)?.station.sessionId ?? null;
    if (sessionId !== null) {
      selectSession(sessionId);
      showSessionView('changes');
    }
  }

  function renderActionError(): ReactElement | null {
    if (actionError === null) {
      return null;
    }
    return (
      <div className="implementation-view__error" role="alert">
        {actionError}
      </div>
    );
  }

  function renderCards(): ReactElement | null {
    if (focusedId === null) {
      return null;
    }
    return (
      <CardStack
        implementation={implementation}
        focusedId={focusedId}
        isManualFocus={isManualFocus}
        now={now}
        changesCount={hasChanges ? stationChangesCount : null}
        session={focusedSession}
        onPickPlan={(stationId: string, model: ModelId | null, effort: Effort | null): void => {
          run(
            () => setStationPlan(implementationId, stationId, model, effort),
            'Plan nicht geändert',
          );
        }}
        onPickModel={(stationId: string, model: ModelId): void => {
          const sessionId: string | null = sessionIdOf(stationId);
          if (sessionId !== null) {
            run(() => setSessionModel(sessionId, model), 'Modell nicht gewechselt');
          }
        }}
        onPickEffort={(stationId: string, effort: Effort): void => {
          const sessionId: string | null = sessionIdOf(stationId);
          if (sessionId !== null) {
            run(() => setSessionEffort(sessionId, effort), 'Denkaufwand nicht geändert');
          }
        }}
        onFocus={(focusId: string): void => {
          setFocused(implementationId, focusId);
        }}
        onBackToCurrent={(): void => {
          clearFocused(implementationId);
        }}
        onOpenChat={openChat}
        onOpenSession={selectSession}
        onShowChanges={(stationId: string): void => {
          openStationChanges(stationId);
        }}
        onStart={(stationId: string): void => {
          run(() => startStation(implementationId, stationId), 'Start fehlgeschlagen');
        }}
        onCancelCountdown={(stationId: string): void => {
          run(() => cancelStationCountdown(implementationId, stationId));
        }}
        onCompleteByUser={(stationId: string, result: string): void => {
          run(() => completeStationByUser(implementationId, stationId, result));
        }}
        onApplyChange={(accept: boolean): void => {
          run(
            () => applyImplementationChange(implementationId, accept),
            'Übernehmen fehlgeschlagen',
          );
        }}
        onApplyCancel={(accept: boolean): void => {
          run(
            () =>
              accept
                ? applyImplementationCancel(implementationId)
                : discardImplementationCancel(implementationId),
            accept ? 'Bestätigen fehlgeschlagen' : 'Verwerfen fehlgeschlagen',
          );
        }}
      />
    );
  }

  function activeViewShown(): ImplementationViewKind {
    if (isChangesShown) {
      return 'changes';
    }
    return isArtifactsShown ? 'artifacts' : 'flow';
  }

  function renderBody(): ReactNode {
    if (isChangesShown) {
      return changes;
    }
    if (isArtifactsShown) {
      return artifacts;
    }
    return (
      <div className="implementation-view">
        <div ref={timelineRef} className="implementation-view__timeline">
          <Timeline
            implementation={implementation}
            focusedId={focusedId}
            now={now}
            onFocus={(focusId: string): void => {
              setFocused(implementationId, focusId);
            }}
            onOpenChat={openChat}
          />
        </div>
        <div className="implementation-view__cards">{renderCards()}</div>
      </div>
    );
  }

  return (
    <>
      <ImplementationHeader
        implementation={implementation}
        projectName={projectName}
        activeView={activeViewShown()}
        hasChanges={hasChanges}
        changesCount={changesCount}
        artifactCount={artifactCount}
        onShowView={onShowView}
        onOpenProject={onOpenProject}
        terminalCount={terminalCount}
        isTerminalOpen={isTerminalOpen}
        onToggleTerminal={onToggleTerminal}
      />
      <ImplementationBar
        key={implementationId}
        implementation={implementation}
        onCancel={(): void => {
          run(() => cancelImplementation(implementationId), 'Abbrechen fehlgeschlagen');
        }}
        onDelete={(): void => {
          run(() => deleteImplementation(implementationId), 'Löschen fehlgeschlagen');
        }}
        isReportShown={report !== null}
        isInquiryBusy={isInquiryBusy}
        isReportBusy={isReportBusy}
        onNewInquiry={startInquiry}
        onOpenReport={openReport}
        onSetAutoStart={(enabled: boolean): void => {
          run(() => setImplementationAutoStart(implementationId, enabled));
        }}
        onSetStopAfterCurrent={(enabled: boolean): void => {
          run(() => setImplementationStopAfterCurrent(implementationId, enabled));
        }}
      />
      {renderActionError()}
      {renderBody()}
      {report !== null && (
        <ReportPanel
          implementation={implementation}
          initialText={report}
          onClose={(): void => {
            setReport(null);
          }}
        />
      )}
    </>
  );
}
