import { create } from 'zustand';
import type { ChangeScope } from '@/lib/bindings/ChangeScope';
import type { DiffLineKind } from '@/lib/bindings/DiffLineKind';
import type { ReviewComment } from '@/lib/bindings/ReviewComment';

export interface CollectedComment {
  id: string;
  /** Kennung der Diff-Zeile aus `lineIdOf`. */
  lineId: string;
  comment: ReviewComment;
}

export interface OpenCommentBox {
  lineId: string;
  text: string;
}

/** Stabiler Leerwert für Selektoren, damit eine Session ohne Kommentare keinen neuen Array erzeugt. */
export const NO_COMMENTS: readonly CollectedComment[] = [];

/**
 * Kennung einer Diff-Zeile. Der Blickwinkel gehört dazu: „Committed“ zeigt auf der neuen Seite den letzten
 * Commit, „Alle“ das Arbeitsverzeichnis — dieselbe Nummer kann eine andere Zeile sein.
 */
export function lineIdOf(
  scope: ChangeScope,
  repositoryKey: string,
  path: string,
  kind: DiffLineKind,
  line: number,
): string {
  return `${scope}|${repositoryKey}|${path}|${kind === 'deleted' ? 'old' : 'new'}${String(line)}`;
}

interface ReviewState {
  /** Gesammelte, noch nicht gesendete Review-Kommentare je Session; flüchtig wie der Entwurf. */
  collected: Record<string, CollectedComment[]>;
  /** Offenes Kommentarfeld je Session. */
  boxes: Record<string, OpenCommentBox | null>;
  /** Ersetzt den Kommentar zur selben Zeile an seiner Stelle, sonst hängt er einen neuen an. */
  upsert: (sessionId: string, lineId: string, comment: ReviewComment) => void;
  updateText: (sessionId: string, id: string, text: string) => void;
  remove: (sessionId: string, id: string) => void;
  clear: (sessionId: string) => void;
  /** Entfernt nur die genannten Kommentare; später Dazugekommene bleiben. */
  clearIds: (sessionId: string, ids: readonly string[]) => void;
  openBox: (sessionId: string, box: OpenCommentBox) => void;
  setBoxText: (sessionId: string, text: string) => void;
  closeBox: (sessionId: string) => void;
}

export const useReviewStore = create<ReviewState>((set) => ({
  collected: {},
  boxes: {},
  upsert: (sessionId: string, lineId: string, comment: ReviewComment): void => {
    set((state: ReviewState) => {
      const current: CollectedComment[] = state.collected[sessionId] ?? [];
      const hasLine: boolean = current.some((entry: CollectedComment) => entry.lineId === lineId);
      const next: CollectedComment[] = hasLine
        ? current.map((entry: CollectedComment) =>
            entry.lineId === lineId ? { ...entry, comment } : entry,
          )
        : [...current, { id: crypto.randomUUID(), lineId, comment }];
      return { collected: { ...state.collected, [sessionId]: next } };
    });
  },
  updateText: (sessionId: string, id: string, text: string): void => {
    set((state: ReviewState) => ({
      collected: {
        ...state.collected,
        [sessionId]: (state.collected[sessionId] ?? []).map((entry: CollectedComment) =>
          entry.id === id ? { ...entry, comment: { ...entry.comment, text } } : entry,
        ),
      },
    }));
  },
  remove: (sessionId: string, id: string): void => {
    set((state: ReviewState) => ({
      collected: {
        ...state.collected,
        [sessionId]: (state.collected[sessionId] ?? []).filter(
          (entry: CollectedComment) => entry.id !== id,
        ),
      },
    }));
  },
  clear: (sessionId: string): void => {
    set((state: ReviewState) => {
      const remaining: [string, CollectedComment[]][] = Object.entries(state.collected).filter(
        ([entryKey]: [string, CollectedComment[]]) => entryKey !== sessionId,
      );
      return { collected: Object.fromEntries(remaining) };
    });
  },
  clearIds: (sessionId: string, ids: readonly string[]): void => {
    set((state: ReviewState) => ({
      collected: {
        ...state.collected,
        [sessionId]: (state.collected[sessionId] ?? []).filter(
          (entry: CollectedComment) => !ids.includes(entry.id),
        ),
      },
    }));
  },
  openBox: (sessionId: string, box: OpenCommentBox): void => {
    set((state: ReviewState) => ({ boxes: { ...state.boxes, [sessionId]: box } }));
  },
  setBoxText: (sessionId: string, text: string): void => {
    set((state: ReviewState) => {
      const box: OpenCommentBox | null = state.boxes[sessionId] ?? null;
      if (box === null) {
        return {};
      }
      return { boxes: { ...state.boxes, [sessionId]: { ...box, text } } };
    });
  },
  closeBox: (sessionId: string): void => {
    set((state: ReviewState) => ({ boxes: { ...state.boxes, [sessionId]: null } }));
  },
}));
