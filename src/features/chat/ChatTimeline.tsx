import { useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { useVirtualizer, type VirtualItem } from '@tanstack/react-virtual';
import { buildBlocks, type ChatBlock } from '@/features/chat/buildBlocks';
import { ErrorBlock } from '@/features/chat/ErrorBlock';
import { QuestionBlock } from '@/features/chat/QuestionBlock';
import {
  digitQuestionIndex,
  emptyDraft,
  pickOption,
  type PickResult,
  type QuestionDraft,
  type QuestionEntry,
} from '@/features/chat/questionDraft';
import { TextBlock } from '@/features/chat/TextBlock';
import { ThinkingBlock } from '@/features/chat/ThinkingBlock';
import { TodoList } from '@/features/chat/TodoList';
import { ToolGroup } from '@/features/chat/ToolGroup';
import { UserMessage } from '@/features/chat/UserMessage';
import { WorkingIndicator } from '@/features/chat/WorkingIndicator';
import type { ChatEntry } from '@/lib/bindings/ChatEntry';
import type { QuestionAnswer } from '@/lib/bindings/QuestionAnswer';
import type { SessionSummary } from '@/lib/bindings/SessionSummary';
import type { TodoItem } from '@/lib/bindings/TodoItem';
import { answerQuestion } from '@/lib/chat';
import './ChatTimeline.css';

const ESTIMATED_BLOCK_HEIGHT = 40;
const OVERSCAN = 8;
const SURFACE_PADDING_TOP = 20;
const SURFACE_PADDING_BOTTOM = 12;
const STICK_TO_BOTTOM_TOLERANCE = 24;
const LOAD_OLDER_THRESHOLD = 200;
const WORKING_KEY = 'working';
const WORKING_FALLBACK_LABEL = 'Claude arbeitet …';
const DIGIT_KEYS: readonly string[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

interface ChatTimelineProps {
  session: SessionSummary;
  entries: readonly ChatEntry[];
  hasMore: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
}

interface LayoutMark {
  firstSeq: number | null;
  scrollHeight: number;
}

export function ChatTimeline({
  session,
  entries,
  hasMore,
  loadingOlder,
  onLoadOlder,
}: ChatTimelineProps): ReactElement {
  const [containerHeight, setContainerHeight] = useState<number>(0);
  // Auf-/Zugeklappt und halbe Antworten leben hier, nicht im Block: ein Block verlässt beim Scrollen das DOM.
  const [expandedKeys, setExpandedKeys] = useState<ReadonlySet<string>>(() => new Set<string>());
  const [drafts, setDrafts] = useState<ReadonlyMap<string, QuestionDraft>>(
    () => new Map<string, QuestionDraft>(),
  );
  const [sendingIds, setSendingIds] = useState<ReadonlySet<string>>(() => new Set<string>());
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef<boolean>(true);
  const layoutMarkRef = useRef<LayoutMark>({ firstSeq: null, scrollHeight: 0 });

  const blocks: ChatBlock[] = useMemo(() => buildBlocks(entries), [entries]);
  const isWorking: boolean = session.status === 'starting' || session.status === 'running';
  const count: number = blocks.length + (isWorking ? 1 : 0);

  // Die Warnung gilt dem React Compiler, den das Projekt nicht nutzt; die Bibliothek schreibt ADR 002 vor.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count,
    getScrollElement: (): HTMLDivElement | null => scrollRef.current,
    estimateSize: (): number => ESTIMATED_BLOCK_HEIGHT,
    getItemKey: (index: number): string => blocks[index]?.key ?? WORKING_KEY,
    overscan: OVERSCAN,
    paddingStart: SURFACE_PADDING_TOP,
    paddingEnd: SURFACE_PADDING_BOTTOM,
  });
  const totalSize: number = virtualizer.getTotalSize();
  // Wenig Inhalt klebt unten: alle Blöcke rücken um den freien Platz nach unten.
  const bottomOffset: number = Math.max(0, containerHeight - totalSize);

  const lastErrorSeq: number | null = useMemo(() => findLastErrorSeq(entries), [entries]);
  const workingLabel: string = useMemo(() => findActiveTodoLabel(entries), [entries]);
  const oldestOpenQuestion: QuestionEntry | null = useMemo(
    () => findOldestOpenQuestion(entries),
    [entries],
  );

  useEffect(() => {
    const element: HTMLDivElement | null = scrollRef.current;
    if (element === null) {
      return undefined;
    }
    const observer = new ResizeObserver((): void => {
      setContainerHeight(element.clientHeight);
    });
    observer.observe(element);
    return (): void => {
      observer.disconnect();
    };
  }, []);

  // Nach jeder Höhenänderung: vorn Angefügtes ausgleichen, sonst am Ende bleiben, wenn die Ansicht dort stand.
  useLayoutEffect(() => {
    const element: HTMLDivElement | null = scrollRef.current;
    if (element === null) {
      return;
    }
    const firstSeq: number | null = entries[0]?.seq ?? null;
    const previous: LayoutMark = layoutMarkRef.current;
    const isPrepended: boolean =
      previous.firstSeq !== null && firstSeq !== null && firstSeq < previous.firstSeq;
    if (stickToBottomRef.current) {
      element.scrollTop = element.scrollHeight;
    } else if (isPrepended) {
      element.scrollTop += element.scrollHeight - previous.scrollHeight;
    }
    layoutMarkRef.current = { firstSeq, scrollHeight: element.scrollHeight };
  }, [entries, totalSize, containerHeight]);

  // Füllt der Verlauf die Höhe nicht, gibt es kein Scrollen, das Älteres anstößt — dann gleich nachladen.
  useEffect(() => {
    if (hasMore && !loadingOlder && containerHeight > 0 && totalSize <= containerHeight) {
      onLoadOlder();
    }
  }, [hasMore, loadingOlder, containerHeight, totalSize, onLoadOlder]);

  const handleDigit = useEffectEvent((event: KeyboardEvent): void => {
    if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey) {
      return;
    }
    if (isTextTarget(event.target) || oldestOpenQuestion === null) {
      return;
    }
    const optionIndex: number = DIGIT_KEYS.indexOf(event.key);
    if (optionIndex === -1 || sendingIds.has(oldestOpenQuestion.requestId)) {
      return;
    }
    const draft: QuestionDraft = draftFor(oldestOpenQuestion);
    event.preventDefault();
    pick(oldestOpenQuestion, digitQuestionIndex(oldestOpenQuestion, draft), optionIndex);
  });

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      handleDigit(event);
    }
    window.addEventListener('keydown', handleKeyDown);
    return (): void => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  function handleScroll(): void {
    const element: HTMLDivElement | null = scrollRef.current;
    if (element === null) {
      return;
    }
    stickToBottomRef.current =
      element.scrollTop + element.clientHeight >= element.scrollHeight - STICK_TO_BOTTOM_TOLERANCE;
    if (element.scrollTop < LOAD_OLDER_THRESHOLD) {
      onLoadOlder();
    }
  }

  function toggleExpanded(key: string): void {
    setExpandedKeys((current: ReadonlySet<string>) => {
      const next = new Set<string>(current);
      if (!next.delete(key)) {
        next.add(key);
      }
      return next;
    });
  }

  function draftFor(entry: QuestionEntry): QuestionDraft {
    return drafts.get(entry.requestId) ?? emptyDraft(entry);
  }

  function submit(entry: QuestionEntry, answer: QuestionAnswer): void {
    const requestId: string = entry.requestId;
    setSendingIds((current: ReadonlySet<string>) => new Set<string>(current).add(requestId));
    answerQuestion(session.id, requestId, answer)
      .catch((reason: unknown) => {
        console.error('Rückfrage nicht beantwortbar', reason);
      })
      .finally(() => {
        setSendingIds((current: ReadonlySet<string>) => {
          const next = new Set<string>(current);
          next.delete(requestId);
          return next;
        });
      });
  }

  function pick(entry: QuestionEntry, questionIndex: number, optionIndex: number): void {
    const result: PickResult | null = pickOption(
      entry,
      draftFor(entry),
      questionIndex,
      optionIndex,
    );
    if (result === null) {
      return;
    }
    if (result.kind === 'answer') {
      submit(entry, result.answer);
      return;
    }
    setDrafts((current: ReadonlyMap<string, QuestionDraft>) =>
      new Map<string, QuestionDraft>(current).set(entry.requestId, result.draft),
    );
  }

  function renderEntry(key: string, entry: Exclude<ChatEntry, { kind: 'tool' }>): ReactElement {
    switch (entry.kind) {
      case 'user':
        return <UserMessage text={entry.text} />;
      case 'text':
        return <TextBlock text={entry.text} />;
      case 'thinking':
        return (
          <ThinkingBlock
            text={entry.text}
            seconds={entry.seconds}
            isExpanded={expandedKeys.has(key)}
            onToggle={(): void => {
              toggleExpanded(key);
            }}
          />
        );
      case 'todos':
        return <TodoList items={entry.items} />;
      case 'question':
        return (
          <QuestionBlock
            entry={entry}
            draft={draftFor(entry)}
            isSending={sendingIds.has(entry.requestId)}
            onPick={(questionIndex: number, optionIndex: number): void => {
              pick(entry, questionIndex, optionIndex);
            }}
            onSubmit={(answer: QuestionAnswer): void => {
              submit(entry, answer);
            }}
          />
        );
      case 'error':
        return (
          <ErrorBlock
            sessionId={session.id}
            title={entry.title}
            text={entry.text}
            canRestart={session.status === 'error' && entry.seq === lastErrorSeq}
            isLogOpen={expandedKeys.has(key)}
            onToggleLog={(): void => {
              toggleExpanded(key);
            }}
          />
        );
    }
  }

  function renderBlock(block: ChatBlock | undefined): ReactElement {
    if (block === undefined) {
      return <WorkingIndicator label={workingLabel} />;
    }
    if (block.kind === 'tools') {
      return (
        <ToolGroup
          tools={block.tools}
          isExpanded={expandedKeys.has(block.key)}
          onToggle={(): void => {
            toggleExpanded(block.key);
          }}
        />
      );
    }
    return renderEntry(block.key, block.entry);
  }

  return (
    <div
      ref={scrollRef}
      className="chat-timeline"
      role="log"
      aria-live="polite"
      aria-label="Verlauf"
      onScroll={handleScroll}
    >
      <div
        className="chat-timeline__surface"
        style={{ height: `${String(Math.max(totalSize, containerHeight))}px` }}
      >
        {virtualizer.getVirtualItems().map((item: VirtualItem) => (
          <div
            key={item.key}
            ref={virtualizer.measureElement}
            data-index={item.index}
            className="chat-timeline__item"
            style={{ transform: `translateY(${String(item.start + bottomOffset)}px)` }}
          >
            <div className="chat-timeline__block">{renderBlock(blocks[item.index])}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function isTextTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return (
    target.closest('input, textarea, [contenteditable]:not([contenteditable="false"])') !== null
  );
}

function findLastErrorSeq(entries: readonly ChatEntry[]): number | null {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry: ChatEntry | undefined = entries[index];
    if (entry?.kind === 'error') {
      return entry.seq;
    }
  }
  return null;
}

function findActiveTodoLabel(entries: readonly ChatEntry[]): string {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry: ChatEntry | undefined = entries[index];
    if (entry?.kind === 'todos') {
      const active: TodoItem | undefined = entry.items.find(
        (item: TodoItem) => item.state === 'active',
      );
      return active === undefined ? WORKING_FALLBACK_LABEL : active.label;
    }
  }
  return WORKING_FALLBACK_LABEL;
}

function findOldestOpenQuestion(entries: readonly ChatEntry[]): QuestionEntry | null {
  for (const entry of entries) {
    if (entry.kind === 'question' && entry.answer === null) {
      return entry;
    }
  }
  return null;
}
