import { useEffect, useMemo } from 'react';
import type { ReactElement } from 'react';
import { SessionHeader } from '@/app/SessionHeader';
import { Sidebar } from '@/app/Sidebar';
import { BackgroundPanel } from '@/features/background/BackgroundPanel';
import { countRunning, indexByToolUseId } from '@/features/background/backgroundItems';
import { useSessionBackground } from '@/features/background/useSessionBackground';
import { ChatView } from '@/features/chat/ChatView';
import { countChangedFiles } from '@/features/changes/changesScope';
import { ChangesView } from '@/features/changes/ChangesView';
import { useSessionChanges } from '@/features/changes/useSessionChanges';
import { EmptyState } from '@/features/sessions/EmptyState';
import { NewSession } from '@/features/sessions/NewSession';
import { useSessionSummaries } from '@/features/sessions/useSessionSummaries';
import type { BackgroundItem } from '@/lib/bindings/BackgroundItem';
import type { SessionSummary } from '@/lib/bindings/SessionSummary';
import { useBackgroundStore } from '@/stores/background';
import { useSessionsStore, type SessionView } from '@/stores/sessions';
import './App.css';

export function App(): ReactElement {
  const { sessions, upsertSession, removeSession } = useSessionSummaries();
  const activeSessionId: string | null = useSessionsStore((state) => state.activeSessionId);
  const showNewSession: boolean = useSessionsStore((state) => state.showNewSession);
  const activeView: SessionView = useSessionsStore((state) => state.activeView);
  const showView = useSessionsStore((state) => state.showView);
  const selectSession = useSessionsStore((state) => state.selectSession);
  const openNewSession = useSessionsStore((state) => state.openNewSession);
  const closeNewSession = useSessionsStore((state) => state.closeNewSession);
  const isBackgroundOpen: boolean = useBackgroundStore((state) => state.isOpen);
  const toggleBackground = useBackgroundStore((state) => state.toggle);

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
  const currentSession: SessionSummary | undefined =
    sessions.find((session: SessionSummary) => session.id === activeSessionId) ?? sessions[0];

  // Der gewählte Reiter bleibt beim Session-Wechsel stehen; eine Session ohne Repository zeigt den Chat.
  const isChangesView: boolean =
    !showNewSession &&
    activeView === 'changes' &&
    currentSession !== undefined &&
    currentSession.repositoryCount > 0;
  const { changes, error: changesError } = useSessionChanges(
    showNewSession ? null : (currentSession ?? null),
    isChangesView,
  );

  // Kopfzeile (Zähler), Verlauf (Zeilen) und Panel brauchen dieselben Daten — einmal laden, nicht je Verbraucher.
  const visibleSession: SessionSummary | null = showNewSession ? null : (currentSession ?? null);
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

  // Der Core sendet für den Anfangsstatus keine Änderung — die Rückgabe von `createSession` muss selbst in die Liste.
  function handleCreated(summary: SessionSummary): void {
    upsertSession(summary);
    selectSession(summary.id);
  }

  function renderMain(): ReactElement {
    if (showNewSession) {
      return <NewSession onCreated={handleCreated} onCancel={closeNewSession} />;
    }
    if (currentSession !== undefined) {
      return (
        <>
          <SessionHeader
            key={currentSession.id}
            session={currentSession}
            activeView={isChangesView ? 'changes' : 'chat'}
            changesCount={changes === null ? null : countChangedFiles(changes)}
            runningBackgroundCount={countRunning(backgroundItems)}
            isBackgroundOpen={isBackgroundOpen}
            onToggleBackground={toggleBackground}
            onShowView={showView}
          />
          {isChangesView ? (
            <ChangesView
              key={currentSession.id}
              session={currentSession}
              changes={changes}
              error={changesError}
            />
          ) : (
            <ChatView
              key={currentSession.id}
              session={currentSession}
              backgroundByToolUseId={backgroundByToolUseId}
            />
          )}
        </>
      );
    }
    return <EmptyState onCreate={openNewSession} />;
  }

  return (
    <div className="app">
      <Sidebar
        sessions={sessions}
        activeSessionId={showNewSession ? null : (currentSession?.id ?? null)}
        onSelect={selectSession}
        onNew={openNewSession}
        onArchived={removeSession}
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
