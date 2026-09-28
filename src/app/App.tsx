import { useEffect } from 'react';
import type { ReactElement } from 'react';
import { SessionHeader } from '@/app/SessionHeader';
import { Sidebar } from '@/app/Sidebar';
import { ChatView } from '@/features/chat/ChatView';
import { EmptyState } from '@/features/sessions/EmptyState';
import { NewSession } from '@/features/sessions/NewSession';
import { useSessionSummaries } from '@/features/sessions/useSessionSummaries';
import type { SessionSummary } from '@/lib/bindings/SessionSummary';
import { useSessionsStore } from '@/stores/sessions';
import './App.css';

export function App(): ReactElement {
  const { sessions, upsertSession } = useSessionSummaries();
  const activeSessionId: string | null = useSessionsStore((state) => state.activeSessionId);
  const showNewSession: boolean = useSessionsStore((state) => state.showNewSession);
  const selectSession = useSessionsStore((state) => state.selectSession);
  const openNewSession = useSessionsStore((state) => state.openNewSession);
  const closeNewSession = useSessionsStore((state) => state.closeNewSession);

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
          <SessionHeader session={currentSession} />
          <ChatView key={currentSession.id} session={currentSession} />
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
      />
      <main className="app__main">{renderMain()}</main>
    </div>
  );
}
