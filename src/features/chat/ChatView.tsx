import { useEffect, useEffectEvent } from 'react';
import type { ReactElement } from 'react';
import { ChatTimeline } from '@/features/chat/ChatTimeline';
import { Composer } from '@/features/chat/Composer';
import { useChatEntries } from '@/features/chat/useChatEntries';
import type { BackgroundItem } from '@/lib/bindings/BackgroundItem';
import type { SessionStatus } from '@/lib/bindings/SessionStatus';
import type { SessionSummary } from '@/lib/bindings/SessionSummary';
import { pauseSession } from '@/lib/sessions';
import './ChatView.css';

const INTERRUPTIBLE_STATUSES: readonly SessionStatus[] = ['starting', 'running', 'waiting'];

interface ChatViewProps {
  session: SessionSummary;
  backgroundByToolUseId: ReadonlyMap<string, BackgroundItem>;
}

export function ChatView({ session, backgroundByToolUseId }: ChatViewProps): ReactElement {
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

  return (
    <div className="chat-view">
      <ChatTimeline
        session={session}
        entries={entries}
        backgroundByToolUseId={backgroundByToolUseId}
        hasMore={hasMore}
        loadingOlder={loadingOlder}
        onLoadOlder={loadOlder}
      />
      <div className="chat-view__composer">
        <Composer session={session} />
      </div>
    </div>
  );
}
