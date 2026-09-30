import { useTldrView, type TldrViewState } from '@/features/tldr/useTldrView';
import type { SessionTldrView } from '@/lib/bindings/SessionTldrView';
import type { TldrChangedEvent } from '@/lib/bindings/TldrChangedEvent';
import { loadSessionTldr } from '@/lib/tldr';

function concernsSession(event: TldrChangedEvent, sessionId: string): boolean {
  return event.sessionId === sessionId;
}

/** TL;DR einer Session: beim Wählen und bei jedem `tldr://changed` dieser Session. */
export function useSessionTldr(sessionId: string): TldrViewState<SessionTldrView> {
  return useTldrView<SessionTldrView>(sessionId, loadSessionTldr, concernsSession);
}
