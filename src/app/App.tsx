import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import type { UnlistenFn } from '@tauri-apps/api/event';
import { ProjectHeader } from '@/app/ProjectHeader';
import { SessionActionError } from '@/app/SessionActionError';
import { ResizeHandle } from '@/components/ResizeHandle';
import { SessionHeader } from '@/app/SessionHeader';
import { Sidebar } from '@/app/Sidebar';
import { useAppUpdateCheck } from '@/features/appupdate/useAppUpdate';
import { useEnvironmentCheck } from '@/features/environment/useEnvironment';
import { ArchiveDialog } from '@/features/archive/ArchiveDialog';
import { VaultSearchDialog } from '@/features/vault/VaultSearchDialog';
import { BackgroundPanel } from '@/features/background/BackgroundPanel';
import {
  commandDurations,
  countRunning,
  indexByToolUseId,
} from '@/features/background/backgroundItems';
import { useSessionBackground } from '@/features/background/useSessionBackground';
import { IMPLEMENTATION_ARTIFACTS_HEADING } from '@/features/artifacts/artifactTexts';
import { ArtifactsView } from '@/features/artifacts/ArtifactsView';
import { useProjectArtifacts } from '@/features/artifacts/useProjectArtifacts';
import { ChatView } from '@/features/chat/ChatView';
import { useGitStatus } from '@/features/git/useGitStatus';
import { implementationArtifacts } from '@/features/implementation/implementationArtifacts';
import { NoteView } from '@/features/notes/NoteView';
import { freshPhaseIds } from '@/features/report/reportDigest';
import { ReportView } from '@/features/report/ReportView';
import { useReportOfSession } from '@/features/report/useReportOfSession';
import { useReportTidying } from '@/features/report/useReportTidying';
import { ImplementationView as ImplementationMain } from '@/features/implementation/ImplementationView';
import { StationTrail } from '@/features/implementation/StationTrail';
import { useInquiry } from '@/features/implementation/useInquiry';
import { useImplementations } from '@/features/implementation/useImplementations';
import { countChangedFiles } from '@/features/changes/changesScope';
import { useSessionChanges } from '@/features/changes/useSessionChanges';
import { FilesView } from '@/features/files/FilesView';
import type { FilesSession } from '@/features/files/FilesView';
import type { GitSessionStatus } from '@/lib/bindings/GitSessionStatus';
import type { SessionChanges } from '@/lib/bindings/SessionChanges';
import { useFilesStore } from '@/stores/files';
import { ProjectOverview } from '@/features/projects/ProjectOverview';
import { sessionsOf } from '@/features/projects/projectStatus';
import { useProjectSummaries } from '@/features/projects/useProjectSummaries';
import { useRetroProgress } from '@/features/retro/useRetroProgress';
import { EmptyState } from '@/features/sessions/EmptyState';
import { NewSession } from '@/features/sessions/NewSession';
import { OverlapBar } from '@/features/sessions/OverlapBar';
import { useSessionOverlaps } from '@/features/sessions/useSessionOverlaps';
import { useSessionSummaries } from '@/features/sessions/useSessionSummaries';
import { openSide } from '@/features/side/openSide';
import { TerminalDock } from '@/features/terminal/TerminalDock';
import { useProjectTerminals } from '@/features/terminal/useProjectTerminals';
import { useViewedSession } from '@/features/sessions/useViewedSession';
import { SettingsView } from '@/features/settings/SettingsView';
import { useSettings } from '@/features/settings/useSettings';
import { SkinBackdrop } from '@/features/skins/SkinBackdrop';
import { useActiveSkins } from '@/features/skins/useActiveSkins';
import { UsageAlertBar } from '@/features/usage/UsageAlertBar';
import { useVoiceModel } from '@/features/voice/useVoiceModel';
import { useWaitingJump } from '@/features/waiting/useWaitingJump';
import { WaitingJumpNotice } from '@/features/waiting/WaitingJumpNotice';
import { onArtifactShow } from '@/lib/artifacts';
import type { ArtifactList } from '@/lib/bindings/ArtifactList';
import type { ArtifactShowEvent } from '@/lib/bindings/ArtifactShowEvent';
import type { BackgroundItem } from '@/lib/bindings/BackgroundItem';
import type { ChangesReach } from '@/lib/bindings/ChangesReach';
import type { HandoffStartedEvent } from '@/lib/bindings/HandoffStartedEvent';
import type { ImplementationView } from '@/lib/bindings/ImplementationView';
import type { OperatingMode } from '@/lib/bindings/OperatingMode';
import type { ProjectCreated } from '@/lib/bindings/ProjectCreated';
import type { ProjectRestored } from '@/lib/bindings/ProjectRestored';
import type { ProjectSummary } from '@/lib/bindings/ProjectSummary';
import type { SessionSummary } from '@/lib/bindings/SessionSummary';
import type { TerminalInfo } from '@/lib/bindings/TerminalInfo';
import type { NotePlacement } from '@/lib/bindings/NotePlacement';
import type { TerminalPlacement } from '@/lib/bindings/TerminalPlacement';
import { onHandoffStarted } from '@/lib/sessions';
import { usePanelWidth } from '@/lib/usePanelWidth';
import { useArtifactsStore } from '@/stores/artifacts';
import { useBackgroundStore } from '@/stores/background';
import { useImplementationStore } from '@/stores/implementation';
import { useReportStore } from '@/stores/report';
import {
  useSessionsStore,
  type ImplementationViewKind,
  type ProjectView,
  type SessionView,
} from '@/stores/sessions';
import { useSettingsStore } from '@/stores/settings';
import { useTerminalStore } from '@/stores/terminal';
import './App.css';

/** Gemeinsames leeres Feld, damit der Store-Selektor nicht bei jedem Aufruf ein neues liefert. */
const NOTHING_VISITED: readonly string[] = [];

export function App(): ReactElement {
  const { sessions, upsertSession, removeSession, error: sessionsError } = useSessionSummaries();
  const { projects, upsertProject, removeProject, error: projectsError } = useProjectSummaries();
  const {
    implementations,
    reload: reloadImplementations,
    error: implementationsError,
  } = useImplementations();
  const activeSessionId: string | null = useSessionsStore((state) => state.activeSessionId);
  const activeImplementationId: string | null = useSessionsStore(
    (state) => state.activeImplementationId,
  );
  const showImplementation: boolean = useSessionsStore((state) => state.showImplementation);
  const implementationView: ImplementationViewKind = useSessionsStore(
    (state) => state.implementationView,
  );
  const selectImplementation = useSessionsStore((state) => state.selectImplementation);
  const showImplementationView = useSessionsStore((state) => state.showImplementationView);
  const activeProjectId: string | null = useSessionsStore((state) => state.activeProjectId);
  const showProjectOverview: boolean = useSessionsStore((state) => state.showProjectOverview);
  const showNewSession: boolean = useSessionsStore((state) => state.showNewSession);
  const showSettings: boolean = useSessionsStore((state) => state.showSettings);
  const activeView: SessionView = useSessionsStore((state) => state.activeView);
  const projectView: ProjectView = useSessionsStore((state) => state.projectView);
  const showView = useSessionsStore((state) => state.showView);
  const showProjectView = useSessionsStore((state) => state.showProjectView);
  const selectSession = useSessionsStore((state) => state.selectSession);
  const selectProject = useSessionsStore((state) => state.selectProject);
  const openNewSession = useSessionsStore((state) => state.openNewSession);
  const closeNewSession = useSessionsStore((state) => state.closeNewSession);
  const openSettings = useSessionsStore((state) => state.openSettings);
  const [isArchiveOpen, setIsArchiveOpen] = useState<boolean>(false);
  const [isVaultOpen, setIsVaultOpen] = useState<boolean>(false);
  // Der Vault-Einstieg gilt nur mit gesetztem Ordner und eingeschaltetem Schalter.
  const hasVault: boolean = useSettingsStore(
    (state) => state.settings?.libraryDir != null && state.settings.vaultEnabled,
  );
  const isBackgroundOpen: boolean = useBackgroundStore((state) => state.isOpen);
  const toggleBackground = useBackgroundStore((state) => state.toggle);
  const {
    overview: settingsOverview,
    error: settingsError,
    reload: reloadSettings,
  } = useSettings();
  // Kontingent-Warnungen kommen nur von der Claude-Kommandozeile mit dem Claude-Abo.
  const operatingMode: OperatingMode = useSettingsStore(
    (state) => state.settings?.operatingMode ?? 'claude',
  );
  const isClaude: boolean = useSettingsStore(
    (state) => (state.settings?.operatingMode ?? 'claude') === 'claude',
  );
  const sidebarWidth = usePanelWidth('sidebar');
  const backgroundWidth = usePanelWidth('background');
  useVoiceModel();
  useRetroProgress();
  // Die aktiven Skin-Pakete liegen im Store; Statuszeile und Feier-Momente lesen sie dort.
  useActiveSkins();
  // Die Abfrage beim Start füllt den Store; der Punkt an „Einstellungen“ liest ihn.
  useAppUpdateCheck();
  // Dito für die Umgebung: der Punkt an „Einstellungen“ liest den Store.
  useEnvironmentCheck();

  // „Automatisch weiter“ (ADR 040): wer gerade die alte Session ansieht, landet in der neuen. Die
  // neue Session selbst kommt über `session://changed` in die Liste.
  useEffect(() => {
    const controller = new AbortController();
    let unlisten: UnlistenFn | null = null;
    onHandoffStarted((event: HandoffStartedEvent) => {
      const state = useSessionsStore.getState();
      if (
        state.activeSessionId === event.fromSessionId &&
        !state.showNewSession &&
        !state.showSettings &&
        !state.showProjectOverview &&
        !state.showImplementation
      ) {
        state.selectSession(event.toSessionId);
      }
    })
      .then((stop: UnlistenFn) => {
        if (controller.signal.aborted) {
          stop();
          return;
        }
        unlisten = stop;
      })
      .catch((reason: unknown) => {
        console.error('Automatisch weiter nicht abonnierbar', reason);
      });
    return (): void => {
      controller.abort();
      if (unlisten !== null) {
        unlisten();
      }
    };
  }, []);
  // MCP-Zugang (ADR 046): der Agent wählt ein Artefakt aus. Ausgewählt wird immer; die Ansicht
  // springt nur, wenn der Benutzer gerade diese Session oder die Übersicht ihres Vorhabens sieht.
  useEffect(() => {
    const controller = new AbortController();
    let unlisten: UnlistenFn | null = null;
    onArtifactShow((event: ArtifactShowEvent) => {
      useArtifactsStore.getState().select(event.projectId, event.file);
      const state = useSessionsStore.getState();
      if (state.showNewSession || state.showSettings || state.showImplementation) {
        return;
      }
      if (state.showProjectOverview) {
        if (state.activeProjectId === event.projectId) {
          state.showProjectView('artifacts');
        }
        return;
      }
      if (state.activeSessionId === event.sessionId) {
        state.showView('artifacts');
      }
    })
      .then((stop: UnlistenFn) => {
        if (controller.signal.aborted) {
          stop();
          return;
        }
        unlisten = stop;
      })
      .catch((reason: unknown) => {
        console.error('Auswahl von Artefakten nicht abonnierbar', reason);
      });
    return (): void => {
      controller.abort();
      if (unlisten !== null) {
        unlisten();
      }
    };
  }, []);
  useSessionOverlaps();
  // „Neues Vorhaben“ und die Einstellungen ersetzen den Inhalt; Session und Übersicht sind dann nicht sichtbar.
  const isMainReplaced: boolean = showNewSession || showSettings;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.ctrlKey && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        openNewSession();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return (): void => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [openNewSession]);

  useEffect(() => {
    if (!hasVault) {
      return undefined;
    }
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.ctrlKey && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsVaultOpen(true);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return (): void => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [hasVault]);

  // Ohne gewählte Session öffnet sich die neueste (Sessions kommen neueste zuerst) — nach einem Neustart
  // steht sonst der Leerzustand vor einer vollen Sidebar.
  // Die Übersicht eines Vorhabens gilt nur, solange das Vorhaben da ist (archiviert → bisherige Auswahl); ihre
  // Changes und Zähler liest der Core über die Session mit der höchsten Nummer.
  // Eine Umsetzung (ADR 048) zeigt sich wie die Übersicht in der Reichweite ihres Vorhabens: Changes
  // und Artefakte liest der Core über dessen Session mit der höchsten Nummer.
  const shownImplementation: ImplementationView | undefined =
    showImplementation && !isMainReplaced && activeImplementationId !== null
      ? implementations.find(
          (implementation: ImplementationView) => implementation.id === activeImplementationId,
        )
      : undefined;
  const overviewProjectId: string | null =
    shownImplementation?.projectId ??
    (showProjectOverview && !isMainReplaced ? activeProjectId : null);
  const overviewProject: ProjectSummary | undefined =
    overviewProjectId === null
      ? undefined
      : projects.find((project: ProjectSummary) => project.id === overviewProjectId);
  const overviewSessions: SessionSummary[] =
    overviewProject === undefined ? [] : sessionsOf(overviewProject.id, sessions);
  const isOverview: boolean = overviewProject !== undefined && overviewSessions.length > 0;
  const isImplementation: boolean = isOverview && shownImplementation !== undefined;
  const hasProjectRepositories: boolean = (overviewProject?.repositoryNames.length ?? 0) > 0;
  const currentSession: SessionSummary | undefined = isOverview
    ? overviewSessions[overviewSessions.length - 1]
    : (sessions.find((session: SessionSummary) => session.id === activeSessionId) ?? sessions[0]);
  const shownSessionId: string | null =
    isMainReplaced || isOverview ? null : (currentSession?.id ?? null);
  // „Review“ in einer Station-Session zeigt den Bericht ihrer Umsetzung; der Reiter erscheint erst, wenn dieser
  // etwas enthält. Die Umsetzung selbst steuert ihren Reiter in `ImplementationView`.
  const isStationShown: boolean =
    !isMainReplaced &&
    !isOverview &&
    currentSession !== undefined &&
    currentSession.stationOf !== null;
  const isReportEnabled: boolean = useSettingsStore(
    (state) => state.settings?.reportEnabled ?? true,
  );
  const reportImplementationId: string | null = useReportOfSession(
    isStationShown && isReportEnabled ? (currentSession?.id ?? null) : null,
    isStationShown && isReportEnabled,
  );
  const reportImplementation: ImplementationView | undefined =
    reportImplementationId === null
      ? undefined
      : implementations.find(
          (candidate: ImplementationView) => candidate.id === reportImplementationId,
        );
  const reportVisited: readonly string[] = useReportStore((state) =>
    reportImplementationId === null
      ? NOTHING_VISITED
      : (state.visitedByImplementation[reportImplementationId] ?? NOTHING_VISITED),
  );
  const hasFreshReport: boolean =
    reportImplementation !== undefined &&
    freshPhaseIds(reportImplementation, reportVisited).length > 0;
  const isReportTidying: boolean = useReportTidying(reportImplementation?.id ?? null).length > 0;
  const isReportView: boolean =
    isStationShown && activeView === 'review' && reportImplementation !== undefined;
  // Bei offener Umsetzung zählt die Station im Fokus als die gezeigte.
  const shownStationId: string | null = useImplementationStore((state) =>
    shownImplementation === undefined ? null : (state.focused[shownImplementation.id] ?? null),
  );
  const waitingNotice: string | null = useWaitingJump(sessions, implementations, {
    sessionId: shownSessionId,
    stationId: shownStationId,
  });

  // Der gewählte Reiter bleibt beim Session-Wechsel stehen; ohne Repository gibt es keine Dateien.
  const isFilesView: boolean = isOverview
    ? (isImplementation ? implementationView : projectView) === 'files' && hasProjectRepositories
    : !isMainReplaced &&
      activeView === 'files' &&
      currentSession !== undefined &&
      currentSession.repositoryCount > 0;
  // Die Artefakte gehören dem Vorhaben; in der Übersicht fragt die neueste Session ab (wie bei den Changes).
  const { list: artifacts }: { list: ArtifactList | null } = useProjectArtifacts(
    isMainReplaced ? null : (currentSession?.id ?? null),
    isMainReplaced ? null : (currentSession?.projectId ?? null),
  );
  const artifactCount: number = artifacts?.items.length ?? 0;
  // Die Umsetzung zeigt nur, was Sessions ihrer Stationen und Rückfragen angelegt haben.
  const implementationArtifactList: ArtifactList | null = useMemo(
    () =>
      artifacts === null || shownImplementation === undefined
        ? null
        : implementationArtifacts(artifacts, shownImplementation, sessions),
    [artifacts, shownImplementation, sessions],
  );
  // Ohne Artefakt fällt die Ansicht auf Chat bzw. Übersicht zurück.
  const isArtifactsView: boolean = isOverview
    ? !isImplementation && projectView === 'artifacts' && artifactCount > 0
    : !isMainReplaced && activeView === 'artifacts' && artifactCount > 0;
  const notePlacement: NotePlacement = useSettingsStore(
    (state) => state.settings?.notePlacement ?? 'dock',
  );
  // „Notiz“ oben gibt es nur mit der Einstellung „Als Reiter oben“; sonst fällt die Ansicht zurück.
  const isNoteTab: boolean =
    notePlacement === 'tab' &&
    (isOverview
      ? !isImplementation && projectView === 'note'
      : !isMainReplaced && activeView === 'note');
  const changesReach: ChangesReach = isOverview ? 'project' : 'session';
  const {
    changes,
    error: changesError,
    reload: reloadChanges,
  } = useSessionChanges(
    isMainReplaced ? null : (currentSession ?? null),
    changesReach,
    isFilesView || isOverview,
  );
  // „Dateien“ zeigt immer das ganze Vorhaben; in der Übersicht sind das schon die Changes oben.
  const {
    changes: sessionProjectChanges,
    error: sessionProjectError,
    reload: reloadProjectChanges,
  } = useSessionChanges(
    isMainReplaced || isOverview ? null : (currentSession ?? null),
    'project',
    isFilesView,
  );
  const projectChanges: SessionChanges | null = isOverview ? changes : sessionProjectChanges;
  const projectChangesError: string | null = isOverview ? changesError : sessionProjectError;
  const filesViewKey: string =
    shownImplementation !== undefined && isImplementation
      ? `implementation:${shownImplementation.id}`
      : isOverview && overviewProject !== undefined
        ? `project:${overviewProject.id}`
        : `session:${currentSession?.id ?? ''}`;
  const filesFilterId: string | null = useFilesStore(
    (state) => state.selections[filesViewKey]?.sessionFilter ?? null,
  );
  const filesSessions: SessionSummary[] =
    currentSession === undefined ? [] : sessionsOf(currentSession.projectId, sessions);
  const filteredSession: SessionSummary | null =
    filesFilterId === null
      ? null
      : (filesSessions.find((session: SessionSummary) => session.id === filesFilterId) ?? null);
  const { changes: filteredChanges, error: filteredChangesError } = useSessionChanges(
    isFilesView ? filteredSession : null,
    'session',
    isFilesView,
  );

  // Strg P: aus jeder Ansicht des Vorhabens in „Dateien“ und mit dem Fokus ins Suchfeld. Ohne Repository gibt
  // es nichts zu suchen, dann bleibt das Kürzel unberührt.
  const canSearchFiles: boolean = isOverview
    ? hasProjectRepositories
    : !isMainReplaced && currentSession !== undefined && currentSession.repositoryCount > 0;
  useEffect(() => {
    if (!canSearchFiles) {
      return undefined;
    }
    function handleKeyDown(event: KeyboardEvent): void {
      if (!event.ctrlKey || event.shiftKey || event.altKey || event.key.toLowerCase() !== 'p') {
        return;
      }
      event.preventDefault();
      if (isImplementation) {
        showImplementationView('files');
      } else if (isOverview) {
        showProjectView('files');
      } else {
        showView('files');
      }
      const files = useFilesStore.getState();
      files.update(filesViewKey, {
        focusSearch: (files.selections[filesViewKey]?.focusSearch ?? 0) + 1,
      });
    }
    window.addEventListener('keydown', handleKeyDown);
    return (): void => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    canSearchFiles,
    isImplementation,
    isOverview,
    filesViewKey,
    showImplementationView,
    showProjectView,
    showView,
  ]);

  // Kopfzeile (Zähler), Verlauf (Zeilen) und Panel brauchen dieselben Daten — einmal laden, nicht je Verbraucher.
  // Die Übersicht hat keinen Knopf für das Panel und zeigt deshalb keins.
  const visibleSession: SessionSummary | null =
    isMainReplaced || isOverview ? null : (currentSession ?? null);
  useViewedSession(visibleSession === null ? null : visibleSession.id);
  // Git-Zustand für Branch-Pille (Kopfzeile) und Git-Seite („Dateien“): einmal je sichtbarer Session, nur in der
  // Reichweite Session — die Übersicht des Vorhabens bedient kein Git.
  const { status: gitStatus, reload: reloadGit } = useGitStatus(visibleSession, isFilesView);
  // Baum und Verlauf des Reiters laden von selbst neu, sobald sich die Changes des Vorhabens ändern.
  const reloadAfterGitAction = useCallback((): void => {
    reloadGit();
    reloadChanges();
    reloadProjectChanges();
  }, [reloadGit, reloadChanges, reloadProjectChanges]);
  const { background, error: backgroundError } = useSessionBackground(
    visibleSession === null ? null : visibleSession.id,
  );
  const backgroundItems: readonly BackgroundItem[] = useMemo(
    () => (background === null ? [] : background.items),
    [background],
  );
  const backgroundByToolUseId: ReadonlyMap<string, BackgroundItem> = useMemo(
    () => indexByToolUseId(backgroundItems),
    [backgroundItems],
  );
  const durationByToolUseId: ReadonlyMap<string, number> = useMemo(
    () => commandDurations(backgroundItems),
    [backgroundItems],
  );

  // Das Terminal-Dock gehört dem sichtbaren Vorhaben (Session oder Übersicht); in „Neues Vorhaben“ und den
  // Einstellungen gibt es keins.
  const terminalProjectId: string | null = isMainReplaced
    ? null
    : (currentSession?.projectId ?? null);
  const {
    terminals,
    isLoaded: areTerminalsLoaded,
    error: terminalsError,
  } = useProjectTerminals(terminalProjectId);
  const runningTerminalCount: number = terminals.filter(
    (terminal: TerminalInfo) => terminal.running,
  ).length;
  const terminalPlacement: TerminalPlacement = useSettingsStore(
    (state) => state.settings?.terminalPlacement ?? 'bottom',
  );
  const isTerminalOpen: boolean = useTerminalStore((state) => state.isOpen);
  const isTerminalMaximized: boolean = useTerminalStore((state) => state.isMaximized);
  const toggleTerminalOpen = useTerminalStore((state) => state.toggle);
  const closeTerminalDock = useTerminalStore((state) => state.close);
  const closeBackground = useBackgroundStore((state) => state.close);
  const isDockShown: boolean = isTerminalOpen && terminalProjectId !== null;
  const isDockFilling: boolean =
    isDockShown && isTerminalMaximized && terminalPlacement === 'bottom';

  // Rechts teilen sich Dock und Hintergrund-Panel den Platz: das eine schließt das andere.
  const handleToggleTerminal = useCallback((): void => {
    if (!isTerminalOpen && terminalPlacement === 'right') {
      closeBackground();
    }
    toggleTerminalOpen();
  }, [isTerminalOpen, terminalPlacement, closeBackground, toggleTerminalOpen]);

  function handleToggleBackground(): void {
    if (!isBackgroundOpen && terminalPlacement === 'right') {
      closeTerminalDock();
    }
    toggleBackground();
  }

  useEffect(() => {
    if (terminalProjectId === null) {
      return undefined;
    }
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.ctrlKey && !event.altKey && event.key.toLowerCase() === 'ö') {
        event.preventDefault();
        handleToggleTerminal();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return (): void => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [terminalProjectId, handleToggleTerminal]);

  function renderTerminalDock(): ReactElement | null {
    if (terminalProjectId === null) {
      return null;
    }
    return (
      <TerminalDock
        key={terminalProjectId}
        projectId={terminalProjectId}
        terminals={terminals}
        isLoaded={areTerminalsLoaded}
        listError={terminalsError}
        placement={terminalPlacement}
      />
    );
  }

  // Strg+; öffnet die Nebenfrage der Session, deren Chat gerade vor der Eingabeleiste steht. Auf deutscher
  // Tastatur liegt das Semikolon auf Umschalt+Komma: `shiftKey` darf die Abfrage nicht ausschließen.
  const chatSessionId: string | null =
    visibleSession !== null && !isFilesView && !isArtifactsView && !isNoteTab && !isReportView
      ? visibleSession.id
      : null;
  useEffect(() => {
    if (chatSessionId === null) {
      return undefined;
    }
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.ctrlKey && !event.altKey && event.key === ';' && chatSessionId !== null) {
        event.preventDefault();
        openSide(chatSessionId, operatingMode);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return (): void => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [chatSessionId, operatingMode]);

  // Der Core sendet für den Anfangsstatus keine Änderung — die Rückgabe von `createProject` muss selbst in die Liste.
  function handleCreated(created: ProjectCreated): void {
    upsertProject(created.project);
    upsertSession(created.session);
    selectSession(created.session.id);
  }

  // Der Core sendet beim Wiederherstellen keine Änderung — die Rückgabe muss selbst in die Listen; die Auswahl bleibt.
  function handleRestored(restored: ProjectRestored): void {
    upsertProject(restored.project);
    for (const session of restored.sessions) {
      upsertSession(session);
    }
    reloadImplementations();
  }

  function handleArchived(projectId: string): void {
    removeProject(projectId);
    reloadImplementations();
    for (const session of sessions) {
      if (session.projectId === projectId) {
        removeSession(session.id);
      }
    }
  }

  function handleSessionDeleted(session: SessionSummary, isProjectDeleted: boolean): void {
    removeSession(session.id);
    if (isProjectDeleted) {
      removeProject(session.projectId);
    }
  }

  function projectNameOf(session: SessionSummary): string {
    const project: ProjectSummary | undefined = projects.find(
      (candidate: ProjectSummary) => candidate.id === session.projectId,
    );
    return project === undefined ? session.name : project.name;
  }

  // Der Core sendet für den Anfangsstatus keine Änderung — die Rückgabe von `createSessionInProject` muss selbst in die Liste.
  function handleSessionCreated(created: SessionSummary): void {
    upsertSession(created);
    selectSession(created.id);
  }

  const startInquiry = useInquiry(handleSessionCreated);

  function renderFiles(
    session: SessionSummary,
    git: GitSessionStatus | null,
    isSessionVisible: boolean,
  ): ReactElement {
    // Die Git-Seite braucht die Changes der Session; in den Übersichten gibt es sie nicht.
    const sessionChanges: SessionChanges | null = isSessionVisible ? changes : null;
    return (
      <FilesView
        key={filesViewKey}
        viewKey={filesViewKey}
        sessionId={session.id}
        projectChanges={projectChanges}
        projectError={projectChangesError}
        filteredChanges={filteredSession === null ? null : filteredChanges}
        filteredError={filteredSession === null ? null : filteredChangesError}
        sessions={filesSessions.map((candidate: SessionSummary): FilesSession => ({
          id: candidate.id,
          number: candidate.number,
          name: candidate.name,
        }))}
        git={git}
        sessionChanges={sessionChanges}
        onChanged={reloadAfterGitAction}
        canComment={isSessionVisible}
      />
    );
  }

  function renderOverview(project: ProjectSummary, latestSession: SessionSummary): ReactElement {
    // Ein Schlüssel für die ganze Ansicht, nicht je Kind: gleiche Schlüssel an Geschwistern lassen React beim
    // Wechsel Kopfzeilen duplizieren statt ersetzen.
    return (
      <Fragment key={project.id}>
        <ProjectHeader
          project={project}
          sessions={overviewSessions}
          activeView={projectViewShown()}
          changesCount={changes === null ? null : countChangedFiles(changes)}
          artifactCount={artifactCount}
          onShowView={showProjectView}
          terminalCount={runningTerminalCount}
          isTerminalOpen={isTerminalOpen}
          onToggleTerminal={handleToggleTerminal}
        />
        {renderOverviewBody(project, latestSession)}
      </Fragment>
    );
  }

  function renderImplementation(
    implementation: ImplementationView,
    project: ProjectSummary,
    latestSession: SessionSummary,
  ): ReactElement {
    return (
      <Fragment key={implementation.id}>
        <ImplementationMain
          implementation={implementation}
          projectName={project.name}
          activeView={implementationView}
          hasChanges={hasProjectRepositories}
          changesCount={changes === null ? null : countChangedFiles(changes)}
          artifactCount={implementationArtifactList?.items.length ?? 0}
          filesViewKey={filesViewKey}
          artifacts={
            implementationArtifactList === null ? null : (
              <ArtifactsView
                sessionId={latestSession.id}
                projectId={project.id}
                currentSessionId={null}
                list={implementationArtifactList}
                heading={IMPLEMENTATION_ARTIFACTS_HEADING}
              />
            )
          }
          sessions={sessions}
          files={renderFiles(latestSession, null, false)}
          onNewInquiry={startInquiry}
          onSessionCreated={handleSessionCreated}
          terminalCount={runningTerminalCount}
          isTerminalOpen={isTerminalOpen}
          onToggleTerminal={handleToggleTerminal}
          onShowView={showImplementationView}
          onOpenProject={(): void => {
            selectProject(project.id);
          }}
        />
      </Fragment>
    );
  }

  function projectViewShown(): ProjectView {
    if (isNoteTab) {
      return 'note';
    }
    if (isArtifactsView) {
      return 'artifacts';
    }
    if (isFilesView) {
      return 'files';
    }
    return 'overview';
  }

  function renderOverviewBody(
    project: ProjectSummary,
    latestSession: SessionSummary,
  ): ReactElement {
    if (isArtifactsView && artifacts !== null) {
      return (
        <ArtifactsView
          sessionId={latestSession.id}
          projectId={project.id}
          currentSessionId={null}
          list={artifacts}
        />
      );
    }
    if (isNoteTab) {
      return <NoteView projectId={project.id} />;
    }
    if (isFilesView) {
      return renderFiles(latestSession, null, false);
    }
    return (
      <ProjectOverview
        project={project}
        sessions={overviewSessions}
        changes={changes}
        onOpenSession={selectSession}
        onSessionCreated={handleSessionCreated}
        onProjectChanged={upsertProject}
      />
    );
  }

  function sessionViewShown(): SessionView {
    if (isNoteTab) {
      return 'note';
    }
    if (isReportView) {
      return 'review';
    }
    if (isArtifactsView) {
      return 'artifacts';
    }
    if (isFilesView) {
      return 'files';
    }
    return 'chat';
  }

  function renderSessionBody(session: SessionSummary): ReactElement {
    if (isArtifactsView && artifacts !== null) {
      return (
        <ArtifactsView
          sessionId={session.id}
          projectId={session.projectId}
          currentSessionId={session.id}
          list={artifacts}
        />
      );
    }
    if (isNoteTab) {
      return <NoteView projectId={session.projectId} />;
    }
    if (isReportView && reportImplementation !== undefined) {
      return (
        <ReportView
          implementation={reportImplementation}
          filesViewKey={filesViewKey}
          onOpenFiles={(): void => {
            showView('files');
          }}
          sessions={sessions}
          onSessionCreated={handleSessionCreated}
        />
      );
    }
    if (isFilesView) {
      return renderFiles(session, gitStatus, true);
    }
    return (
      <ChatView
        session={session}
        projectName={projectNameOf(session)}
        backgroundByToolUseId={backgroundByToolUseId}
        durationByToolUseId={durationByToolUseId}
        artifacts={artifacts}
        onSessionCreated={handleSessionCreated}
        autoHandoff={
          projects.find((project: ProjectSummary) => project.id === session.projectId)
            ?.autoHandoff ?? false
        }
      />
    );
  }

  function renderMain(): ReactElement {
    if (showSettings) {
      return (
        <SettingsView
          sessions={sessions}
          overview={settingsOverview}
          loadError={settingsError}
          onReload={reloadSettings}
        />
      );
    }
    if (showNewSession) {
      return <NewSession onCreated={handleCreated} onCancel={closeNewSession} />;
    }
    if (
      shownImplementation !== undefined &&
      overviewProject !== undefined &&
      isImplementation &&
      currentSession !== undefined
    ) {
      return renderImplementation(shownImplementation, overviewProject, currentSession);
    }
    if (overviewProject !== undefined && isOverview && currentSession !== undefined) {
      return renderOverview(overviewProject, currentSession);
    }
    if (currentSession !== undefined) {
      const trailImplementation: ImplementationView | undefined =
        currentSession.stationOf === null
          ? undefined
          : implementations.find(
              (candidate: ImplementationView) => candidate.id === currentSession.stationOf,
            );
      // Ein Schlüssel für die ganze Ansicht: Kopfzeile, Fehlerleiste und Inhalt wechseln beim Session-Wechsel als Einheit.
      return (
        <Fragment key={currentSession.id}>
          <SessionHeader
            session={currentSession}
            projectName={projectNameOf(currentSession)}
            activeView={sessionViewShown()}
            filesCount={
              sessionProjectChanges === null ? null : countChangedFiles(sessionProjectChanges)
            }
            changes={changes}
            gitStatus={gitStatus}
            artifactCount={artifactCount}
            hasReport={reportImplementation !== undefined}
            hasFreshReport={hasFreshReport}
            isReportTidying={isReportTidying}
            runningBackgroundCount={countRunning(backgroundItems)}
            isBackgroundOpen={isBackgroundOpen}
            onToggleBackground={handleToggleBackground}
            terminalCount={runningTerminalCount}
            isTerminalOpen={isTerminalOpen}
            onToggleTerminal={handleToggleTerminal}
            onShowView={showView}
            onOpenProject={(): void => {
              selectProject(currentSession.projectId);
            }}
          />
          {trailImplementation !== undefined && (
            <StationTrail
              implementation={trailImplementation}
              sessionId={currentSession.id}
              onOpenImplementation={selectImplementation}
            />
          )}
          <SessionActionError sessionId={currentSession.id} />
          {isClaude && <UsageAlertBar />}
          <OverlapBar sessionId={currentSession.id} projectId={currentSession.projectId} />
          {renderSessionBody(currentSession)}
        </Fragment>
      );
    }
    return <EmptyState onCreate={openNewSession} />;
  }

  return (
    <div className="app">
      <Sidebar
        width={sidebarWidth.width}
        projects={projects}
        sessions={sessions}
        implementations={implementations}
        activeSessionId={shownSessionId}
        activeProjectId={activeProjectId}
        activeImplementationId={isImplementation ? (shownImplementation?.id ?? null) : null}
        showProjectOverview={isOverview && !isImplementation}
        isSettingsOpen={showSettings}
        loadError={projectsError ?? sessionsError ?? implementationsError}
        onSelectSession={selectSession}
        onSelectProject={selectProject}
        onSelectImplementation={selectImplementation}
        onNew={openNewSession}
        onOpenSettings={openSettings}
        onOpenArchive={(): void => {
          setIsArchiveOpen(true);
        }}
        onOpenVault={(): void => {
          setIsVaultOpen(true);
        }}
        onArchived={handleArchived}
        onSessionDeleted={handleSessionDeleted}
      />
      <ResizeHandle edge="end" label="Breite der Seitenleiste" {...sidebarWidth.handleProps} />
      <main className="app__main" data-resize-fill>
        <SkinBackdrop area="content" />
        <div className={`app__content${isDockFilling ? ' app__content--hidden' : ''}`}>
          {renderMain()}
        </div>
        {isDockShown && terminalPlacement === 'bottom' && renderTerminalDock()}
        <WaitingJumpNotice text={waitingNotice} />
      </main>
      {isDockShown && terminalPlacement === 'right' && renderTerminalDock()}
      {isBackgroundOpen && visibleSession !== null && (
        <>
          <ResizeHandle
            edge="start"
            label="Breite des Hintergrunds"
            {...backgroundWidth.handleProps}
          />
          <BackgroundPanel
            key={visibleSession.id}
            width={backgroundWidth.width}
            session={visibleSession}
            background={background}
            error={backgroundError}
          />
        </>
      )}
      {isVaultOpen && hasVault && (
        <VaultSearchDialog
          onClose={(): void => {
            setIsVaultOpen(false);
          }}
        />
      )}
      {isArchiveOpen && (
        <ArchiveDialog
          onRestored={handleRestored}
          onClose={(): void => {
            setIsArchiveOpen(false);
          }}
        />
      )}
    </div>
  );
}
