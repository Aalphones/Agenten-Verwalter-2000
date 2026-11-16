import { useCallback, useEffect, useRef, useState } from 'react';
import { matchesAny } from '@/features/skins/matchSlot';
import type { ChatEntry } from '@/lib/bindings/ChatEntry';
import type { ToolDetail } from '@/lib/bindings/ToolDetail';
import type { ToolState } from '@/lib/bindings/ToolState';
import { loadToolDetail } from '@/lib/toolDetails';

/** Werkzeuge, deren Fertigstellung ein Commit sein kann. */
const COMMIT_TOOLS: readonly string[] = ['Bash', 'PowerShell'];
const COMMIT_COMMAND_PATTERN = '*git*commit*';
const STATION_TOOL = 'mcp__verwalter__implementation_complete_station';
/** Die Kurzkennung steht in der ersten Zeile der Ausgabe (`[main 242dc85] …`). */
const COMMIT_OUTPUT_LIMIT = 400;
const COMMIT_HASH_PATTERN = /\b([0-9a-f]{7,40})\b/;
const SHORT_HASH_LENGTH = 7;

export type CelebrationSlot = 'commit' | 'station';

export interface Celebration {
  slot: CelebrationSlot;
  /** Kurzkennung für `{commit}`; leer, wenn die Ausgabe keine hergab. */
  commit: string;
  /** Neu je Feier-Moment, damit die Meldung ihre 5 Sekunden von vorn zählt. */
  id: number;
}

export interface CelebrationControl {
  celebration: Celebration | null;
  dismiss: () => void;
}

interface CelebrationInput {
  sessionId: string;
  entries: readonly ChatEntry[];
  /** Nur mit aktivem Figurenpaket und eingeschaltetem „Feier-Momente“. */
  isEnabled: boolean;
}

type ToolEntry = Extract<ChatEntry, { kind: 'tool' }>;

/** Einzeiliger Befehl: Zeilenumbrüche würden `*` im Muster nicht überbrücken. */
function isCommitCommand(entry: ToolEntry): boolean {
  if (!COMMIT_TOOLS.includes(entry.tool)) {
    return false;
  }
  return matchesAny(COMMIT_COMMAND_PATTERN, entry.target.replace(/\s+/g, ' '));
}

function celebrationSlotOf(entry: ToolEntry): CelebrationSlot | null {
  if (entry.tool === STATION_TOOL) {
    return 'station';
  }
  return isCommitCommand(entry) ? 'commit' : null;
}

/** Erste 7 Zeichen eines 7–40-stelligen Hex-Worts aus dem Beginn der Ausgabe, sonst leer. */
export function shortCommitId(output: string): string {
  const match: RegExpExecArray | null = COMMIT_HASH_PATTERN.exec(
    output.slice(0, COMMIT_OUTPUT_LIMIT),
  );
  const hash: string | undefined = match?.[1];
  return hash === undefined ? '' : hash.slice(0, SHORT_HASH_LENGTH);
}

/** `seq` der jüngsten Nachricht des Users; `-1`, solange keine im geladenen Verlauf steht. */
function lastUserSeq(entries: readonly ChatEntry[]): number {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry: ChatEntry | undefined = entries[index];
    if (entry?.kind === 'user') {
      return entry.seq;
    }
  }
  return -1;
}

/**
 * Erkennt, wenn ein Commit oder eine Station live fertig wird (Werkzeug-Eintrag wechselt von
 * `running` zu `done`). Einträge, die schon beim Laden fertig waren, feiern nie; je Antwort
 * (bis zur nächsten Nachricht des Users) gibt es höchstens eine Meldung.
 */
export function useCelebrations({
  sessionId,
  entries,
  isEnabled,
}: CelebrationInput): CelebrationControl {
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const previousStatesRef = useRef<Map<string, ToolState>>(new Map());
  const celebratedAfterRef = useRef<number | null>(null);
  const nextIdRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    isMountedRef.current = true;
    return (): void => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const previousStates: Map<string, ToolState> = previousStatesRef.current;
    let finished: ToolEntry | null = null;
    for (const entry of entries) {
      if (entry.kind !== 'tool') {
        continue;
      }
      if (previousStates.get(entry.toolUseId) === 'running' && entry.state === 'done') {
        finished = entry;
      }
      previousStates.set(entry.toolUseId, entry.state);
    }
    if (!isEnabled || finished === null) {
      return;
    }
    const slot: CelebrationSlot | null = celebrationSlotOf(finished);
    const answerKey: number = lastUserSeq(entries);
    if (slot === null || celebratedAfterRef.current === answerKey) {
      return;
    }
    celebratedAfterRef.current = answerKey;
    nextIdRef.current += 1;
    const id: number = nextIdRef.current;
    if (slot === 'station') {
      setCelebration({ slot, commit: '', id });
      return;
    }
    loadToolDetail(sessionId, finished.toolUseId)
      .then((detail: ToolDetail) => shortCommitId(detail.output))
      .catch((reason: unknown) => {
        console.error('Ausgabe des Commits nicht ladbar', reason);
        return '';
      })
      .then((commit: string) => {
        if (isMountedRef.current) {
          setCelebration({ slot, commit, id });
        }
      })
      .catch((reason: unknown) => {
        console.error('Feier-Moment nicht zeigbar', reason);
      });
  }, [entries, isEnabled, sessionId]);

  const dismiss = useCallback((): void => {
    setCelebration(null);
  }, []);

  return { celebration, dismiss };
}
