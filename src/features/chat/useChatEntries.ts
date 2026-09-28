import { useCallback, useEffect, useRef, useState } from 'react';
import type { UnlistenFn } from '@tauri-apps/api/event';
import type { ChatEntry } from '@/lib/bindings/ChatEntry';
import type { ChatEntryEvent } from '@/lib/bindings/ChatEntryEvent';
import type { ChatPage } from '@/lib/bindings/ChatPage';
import { getChatHistory, onChatEntry } from '@/lib/chat';

const PAGE_SIZE = 200;

export interface ChatEntries {
  entries: readonly ChatEntry[];
  hasMore: boolean;
  loadingOlder: boolean;
  loadOlder: () => void;
}

interface ChatSnapshot {
  sessionId: string;
  entries: readonly ChatEntry[];
  hasMore: boolean;
  loadingOlder: boolean;
}

interface ChatLoader {
  receive: (entry: ChatEntry) => void;
  loadLatest: () => void;
  loadOlder: () => void;
}

const NO_ENTRIES: readonly ChatEntry[] = [];

/** Hält einen zusammenhängenden Ausschnitt des Verlaufs einer Session: die neueste Seite, bei Bedarf ältere davor,
 *  und hält ihn über `chat://entry` aktuell. Die Einträge liegen nur hier, nie im Store. */
export function useChatEntries(sessionId: string): ChatEntries {
  const [snapshot, setSnapshot] = useState<ChatSnapshot | null>(null);
  const loaderRef = useRef<ChatLoader | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let unlisten: UnlistenFn | null = null;
    const loader: ChatLoader = createChatLoader(
      sessionId,
      controller.signal,
      (entries: readonly ChatEntry[], hasMore: boolean, loadingOlder: boolean) => {
        setSnapshot({ sessionId, entries, hasMore, loadingOlder });
      },
    );
    loaderRef.current = loader;

    // Erst abonnieren, dann laden: ein Eintrag zwischen Seitenstand und Abo ginge sonst verloren.
    onChatEntry((event: ChatEntryEvent) => {
      if (event.sessionId === sessionId) {
        loader.receive(event.entry);
      }
    })
      .then((stop: UnlistenFn) => {
        if (controller.signal.aborted) {
          stop();
          return;
        }
        unlisten = stop;
        loader.loadLatest();
      })
      .catch((reason: unknown) => {
        console.error('Chat-Ereignisse nicht abonnierbar', reason);
      });

    return (): void => {
      controller.abort();
      loaderRef.current = null;
      if (unlisten !== null) {
        unlisten();
      }
    };
  }, [sessionId]);

  const loadOlder = useCallback((): void => {
    loaderRef.current?.loadOlder();
  }, []);

  // Ein Stand einer anderen Session gilt nicht — so beginnt ein Sessionwechsel leer, ohne Effekt-Reset.
  if (snapshot === null || snapshot.sessionId !== sessionId) {
    return { entries: NO_ENTRIES, hasMore: false, loadingOlder: false, loadOlder };
  }
  return {
    entries: snapshot.entries,
    hasMore: snapshot.hasMore,
    loadingOlder: snapshot.loadingOlder,
    loadOlder,
  };
}

/** Besitzt den geladenen Ausschnitt außerhalb von React, damit Ereignisse, Nachladen und Neuladen
 *  denselben Stand sehen, ohne auf einen Render zu warten. */
function createChatLoader(
  sessionId: string,
  signal: AbortSignal,
  publish: (entries: readonly ChatEntry[], hasMore: boolean, loadingOlder: boolean) => void,
): ChatLoader {
  let entries: readonly ChatEntry[] = NO_ENTRIES;
  let hasMore = false;
  let loadingOlder = false;
  // Nicht `null`, solange die neueste Seite lädt: Ereignisse warten hier, bis der Seitenstand da ist.
  let waiting: ChatEntry[] | null = [];

  function emit(): void {
    publish(entries, hasMore, loadingOlder);
  }

  /** `false` heißt: zwischen dem geladenen Ende und dem Eintrag fehlen Einträge. */
  function apply(entry: ChatEntry): boolean {
    const firstSeq: number = entries[0]?.seq ?? 0;
    const nextSeq: number = firstSeq + entries.length;
    if (entry.seq < firstSeq) {
      return true;
    }
    if (entry.seq < nextSeq) {
      const index: number = entry.seq - firstSeq;
      entries = entries.map((current: ChatEntry, position: number) =>
        position === index ? entry : current,
      );
      return true;
    }
    if (entry.seq === nextSeq) {
      entries = [...entries, entry];
      return true;
    }
    return false;
  }

  function loadLatest(): void {
    waiting ??= [];
    getChatHistory(sessionId, null, PAGE_SIZE)
      .then((page: ChatPage) => {
        if (signal.aborted) {
          return;
        }
        entries = page.entries;
        hasMore = page.hasMore;
        loadingOlder = false;
        const arrived: ChatEntry[] = waiting ?? [];
        waiting = null;
        for (const entry of arrived) {
          if (!apply(entry)) {
            emit();
            loadLatest();
            return;
          }
        }
        emit();
      })
      .catch((reason: unknown) => {
        waiting = null;
        console.error('Verlauf nicht ladbar', reason);
      });
  }

  function receive(entry: ChatEntry): void {
    if (waiting !== null) {
      waiting.push(entry);
      return;
    }
    if (apply(entry)) {
      emit();
      return;
    }
    loadLatest();
  }

  function loadOlder(): void {
    const firstSeq: number | undefined = entries[0]?.seq;
    if (!hasMore || loadingOlder || waiting !== null || firstSeq === undefined) {
      return;
    }
    loadingOlder = true;
    emit();
    getChatHistory(sessionId, firstSeq, PAGE_SIZE)
      .then((page: ChatPage) => {
        if (signal.aborted) {
          return;
        }
        loadingOlder = false;
        // Wurde inzwischen die neueste Seite neu geladen, passt diese ältere nicht mehr davor.
        if (entries[0]?.seq === firstSeq) {
          entries = [...page.entries, ...entries];
          hasMore = page.hasMore;
        }
        emit();
      })
      .catch((reason: unknown) => {
        if (signal.aborted) {
          return;
        }
        loadingOlder = false;
        emit();
        console.error('Ältere Einträge nicht ladbar', reason);
      });
  }

  return { receive, loadLatest, loadOlder };
}
