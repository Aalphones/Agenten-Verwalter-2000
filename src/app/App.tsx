import { Fragment, useEffect, useMemo } from 'react';
import type { ReactElement } from 'react';
import { ProjectHeader } from '@/app/ProjectHeader';
import { SessionActionError } from '@/app/SessionActionError';
import { SessionHeader } from '@/app/SessionHeader';
import { Sidebar } from '@/app/Sidebar';
import { BackgroundPanel } from '@/features/background/BackgroundPanel';
import { countRunning, indexByToolUseId } from '@/features/background/backgroundItems';
import { useSessionBackground } from '@/features/background/useSessionBackground';
import { ChatView } from '@/features/chat/ChatView';
import { countChangedFiles } from '@/features/changes/changesScope';
import { ChangesView } from '@/features/changes/ChangesView';
import { useSessionChanges } from '@/features/changes/useSessionChanges';
import { ProjectOverview } from '@/features/projects/ProjectOverview';
import { sessionsOf } from '@/features/projects/projectStatus';
import { useProjectSummaries } from '@/features/projects/useProjectSummaries';
import { EmptyState } from '@/features/sessions/EmptyState';
import { NewSession } from '@/features/sessions/NewSession';
import { useSessionSummaries } from '@/features/sessions/useSessionSummaries';
import { SettingsView } from '@/features/settings/SettingsView';
import { useSettings } from '@/features/settings/useSettings';
import { useVoiceModel } from '@/features/voice/useVoiceModel';
import type { BackgroundItem } from '@/lib/bindings/BackgroundItem';
import type { ChangesReach } from '@/lib/bindings/ChangesReach';
import type { ProjectCreated } from '@/lib/bindings/ProjectCreated';
import type { ProjectSummary } from '@/lib/bindings/ProjectSummary';
import type { SessionSummary } from '@/lib/bindings/SessionSummary';
import { useBackgroundStore } from '@/stores/background';
import { useSessionsStore, type ProjectView, type SessionView } from '@/stores/sessions';
import './App.css';

export function App(): ReactElement {
  const { sessions, upsertSession, removeSession, error: sessionsError } = useSessionSummaries();
  const { projects, upsertProject, removeProject, error: projectsError } = useProjectSummaries();
  const activeSessionId: string | null = useSessionsStore((state) => state.activeSessionId);
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
  const isBackgroundOpen: boolean = useBackgroundStore((state) => state.isOpen);
  const toggleBackground = useBackgroundStore((state) => state.toggle);
  const {
    overview: settingsOverview,
    error: settingsError,
    reload: reloadSettings,
  } = useSettings();
  useVoiceModel();
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

  // Ohne gewählte Session öffnet sich die neueste (Sessions kommen neueste zuerst) — nach einem Neustart
  // steht sonst der Leerzustand vor einer vollen Sidebar.
  // Die Übersicht eines Vorhabens gilt nur, solange das Vorhaben da ist (archiviert → bisherige Auswahl); ihre
  // Changes und Zähler liest der Core über die Session mit der höchsten Nummer.
  const overviewProject: ProjectSummary | undefined =
    showProjectOverview && !isMainReplaced && activeProjectId !== null
      ? projects.find((project: ProjectSummary) => project.id === activeProjectId)
      : undefined;
  const overviewSessions: SessionSummary[] =
    overviewProject === undefined ? [] : sessionsOf(overviewProject.id, sessions);
  const isOverview: boolean = overviewProject !== undefined && overviewSessions.length > 0;
  const currentSession: SessionSummary | undefined = isOverview
    ? overviewSessions[overviewSessions.length - 1]
    : (sessions.find((session: SessionSummary) => session.id === activeSessionId) ?? sessions[0]);

  // Der gewählte Reiter bleibt beim Session-Wechsel stehen; ohne Repository gibt es keine Changes.
  const isChangesView: boolean = isOverview
    ? projectView === 'changes' && (overviewProject?.repositoryNames.length ?? 0) > 0
    : !isMainReplaced &&
      activeView === 'changes' &&
      currentSession !== undefined &&
      currentSession.repositoryCount > 0;
  const changesReach: ChangesReach = isOverview ? 'project' : 'session';
  const { changes, error: changesError } = useSessionChanges(
    isMainReplaced ? null : (currentSession ?? null),
    changesReach,
    isChangesView || isOverview,
  );

  // Kopfzeile (Zähler), Verlauf (Zeilen) und Panel brauchen dieselben Daten — einmal laden, nicht je Verbraucher.
  // Die Übersicht hat keinen Knopf für das Panel und zeigt deshalb keins.
  const visibleSession: SessionSummary | null =
    isMainReplaced || isOverview ? null : (currentSession ?? null);
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

  // Der Core sendet für den Anfangsstatus keine Änderung — die Rückgabe von `createProject` muss selbst in die Liste.
  function handleCreated(created: ProjectCreated): void {
    upsertProject(created.project);
    upsertSession(created.session);
    selectSession(created.session.id);
  }

  function handleArchived(projectId: string): void {
    removeProject(projectId);
    for (const session of sessions) {
      if (session.projectId === projectId) {
        removeSession(session.id);
      }
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

  function renderOverview(project: ProjectSummary, latestSession: SessionSummary): ReactElement {
    return (
      <>
        <ProjectHeader
          key={project.id}
          project={project}
          sessions={overviewSessions}
          activeView={isChangesView ? 'changes' : 'overview'}
          changesCount={changes === null ? null : countChangedFiles(changes)}
          onShowView={showProjectView}
        />
        {isChangesView ? (
          <ChangesView
            key={latestSession.id}
            session={latestSession}
            changes={changes}
            error={changesError}
            reach="project"
          />
        ) : (
          <ProjectOverview
            key={project.id}
            project={project}
            sessions={overviewSessions}
            changes={changes}
            onOpenSession={selectSession}
            onSessionCreated={handleSessionCreated}
            onProjectChanged={upsertProject}
          />
        )}
      </>
    );
  }

  function renderMain(): ReactElement {
    if (showSettings) {
      return (
        <SettingsView
          overview={settingsOverview}
          loadError={settingsError}
          onReload={reloadSettings}
        />
      );
    }
    if (showNewSession) {
      return <NewSession onCreated={handleCreated} onCancel={closeNewSession} />;
    }
    if (overviewProject !== undefined && isOverview && currentSession !== undefined) {
      return renderOverview(overviewProject, currentSession);
    }
    if (currentSession !== undefined) {
      // Ein Schlüssel für die ganze Ansicht: Kopfzeile, Fehlerleiste und Inhalt wechseln beim Session-Wechsel als Einheit.
      return (
        <Fragment key={currentSession.id}>
          <SessionHeader
            session={currentSession}
            projectName={projectNameOf(currentSession)}
            activeView={isChangesView ? 'changes' : 'chat'}
            changesCount={changes === null ? null : countChangedFiles(changes)}
            runningBackgroundCount={countRunning(backgroundItems)}
            isBackgroundOpen={isBackgroundOpen}
            onToggleBackground={toggleBackground}
            onShowView={showView}
            onOpenProject={(): void => {
              selectProject(currentSession.projectId);
            }}
          />
          <SessionActionError sessionId={currentSession.id} />
          {isChangesView ? (
            <ChangesView
              session={currentSession}
              changes={changes}
              error={changesError}
              reach="session"
            />
          ) : (
            <ChatView
              session={currentSession}
              projectName={projectNameOf(currentSession)}
              backgroundByToolUseId={backgroundByToolUseId}
            />
          )}
        </Fragment>
      );
    }
    return <EmptyState onCreate={openNewSession} />;
  }

  return (
    <div className="app">
      <Sidebar
        projects={projects}
        sessions={sessions}
        activeSessionId={isMainReplaced || isOverview ? null : (currentSession?.id ?? null)}
        activeProjectId={activeProjectId}
        showProjectOverview={isOverview}
        isSettingsOpen={showSettings}
        loadError={projectsError ?? sessionsError}
        onSelectSession={selectSession}
        onSelectProject={selectProject}
        onNew={openNewSession}
        onOpenSettings={openSettings}
        onArchived={handleArchived}
      />
      <main className="app__main">{renderMain()}</main>
      {isBackgroundOpen && visibleSession !== null && (
        <BackgroundPanel
          key={visibleSession.id}
          session={visibleSession}
          background={background}
          error={backgroundError}
        />
      )}
    </div>
  );
}
