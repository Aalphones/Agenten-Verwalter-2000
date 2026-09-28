import type { ReactElement } from 'react';
import { ChatTimeline } from '@/features/chat/ChatTimeline';
import { useChatEntries } from '@/features/chat/useChatEntries';
import type { SessionSummary } from '@/lib/bindings/SessionSummary';
import './ChatView.css';

interface ChatViewProps {
  session: SessionSummary;
}

export function ChatView({ session }: ChatViewProps): ReactElement {
  const { entries, hasMore, loadingOlder, loadOlder } = useChatEntries(session.id);

  return (
    <div className="chat-view">
      <ChatTimeline
        session={session}
        entries={entries}
        hasMore={hasMore}
        loadingOlder={loadingOlder}
        onLoadOlder={loadOlder}
      />
      <div className="chat-view__composer" />
    </div>
  );
}
