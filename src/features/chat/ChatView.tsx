import { useEffect, useEffectEvent } from 'react';
import type { ReactElement } from 'react';
import { ChatTimeline } from '@/features/chat/ChatTimeline';
import { Composer } from '@/features/chat/Composer';
import { useChatEntries } from '@/features/chat/useChatEntries';
import { NewSessionIntro } from '@/features/projects/NewSessionIntro';
import { SessionTldrCard } from '@/features/tldr/SessionTldrCard';
import type { BackgroundItem } from '@/lib/bindings/BackgroundItem';
import type { ChatEntry } from '@/lib/bindings/ChatEntry';
import type { SessionStatus } from '@/lib/bindings/SessionStatus';
import type { SessionSummary } from '@/lib/bindings/SessionSummary';
import { pauseSession } from '@/lib/sessions';
import './ChatView.css';

const INTERRUPTIBLE_STATUSES: readonly SessionStatus[] = ['starting', 'running', 'waiting'];

interface ChatViewProps {
  session: SessionSummary;
  projectName: string;
  backgroundByToolUseId: ReadonlyMap<string, BackgroundItem>;
}

/** Die Einträge einer Session sind ab 0 durchnummeriert; der letzte geladene trägt die höchste `seq`. */
function entryCount(entries: readonly ChatEntry[]): number {
  const last: ChatEntry | undefined = entries[entries.length - 1];
  if (last === undefined) {
    return 0;
  }
  return last.seq + 1;
}

export function ChatView({
  session,
  projectName,
  backgroundByToolUseId,
}: ChatViewProps): ReactElement {
  const { entries, hasMore, loadingOlder, loadOlder } = useChatEntries(session.id);
  const canInterrupt: boolean = INTERRUPTIBLE_STATUSES.includes(session.status);

  // Ein Menü, das Esc zum Schließen verbraucht hat, setzt `defaultPrevented` — dann nicht pausieren.
  const handleEscape = useEffectEvent((event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || event.defaultPrevented) {
      return;
    }
    pauseSession(session.id).catch((reason: unknown) => {
      console.error('Session nicht pausierbar', reason);
    });
  });

  useEffect(() => {
    if (!canInterrupt) {
      return undefined;
    }
    function handleKeyDown(event: KeyboardEvent): void {
      handleEscape(event);
    }
    window.addEventListener('keydown', handleKeyDown);
    return (): void => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [canInterrupt]);

  function renderTimeline(): ReactElement {
    if (session.status === 'new') {
      return (
        <NewSessionIntro
          sessionId={session.id}
          projectId={session.projectId}
          projectName={projectName}
          number={session.number}
        />
      );
    }
    return (
      <ChatTimeline
        session={session}
        entries={entries}
        backgroundByToolUseId={backgroundByToolUseId}
        hasMore={hasMore}
        loadingOlder={loadingOlder}
        onLoadOlder={loadOlder}
      />
    );
  }

  return (
    <div className="chat-view">
      <SessionTldrCard session={session} entryCount={entryCount(entries)} />
      {renderTimeline()}
      <div className="chat-view__composer">
        <Composer session={session} />
      </div>
    </div>
  );
}
