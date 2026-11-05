import { create } from 'zustand';
import type { QuestionDraft } from '@/features/chat/questionDraft';

interface ChatState {
  /** Ungesendeter Text der Eingabeleiste je Session. */
  drafts: Record<string, string>;
  setDraft: (sessionId: string, text: string) => void;
  clearDraft: (sessionId: string) => void;
  /** Halbe Antworten auf Rückfragen je Session und Anfrage-ID; Chat und Karte der Umsetzung teilen sie. */
  questionDrafts: Record<string, Record<string, QuestionDraft>>;
  setQuestionDraft: (sessionId: string, requestId: string, draft: QuestionDraft) => void;
  clearQuestionDraft: (sessionId: string, requestId: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  drafts: {},
  setDraft: (sessionId: string, text: string): void => {
    set((state: ChatState) => ({ drafts: { ...state.drafts, [sessionId]: text } }));
  },
  clearDraft: (sessionId: string): void => {
    set((state: ChatState) => {
      const remaining: [string, string][] = Object.entries(state.drafts).filter(
        ([id]: [string, string]) => id !== sessionId,
      );
      return { drafts: Object.fromEntries(remaining) };
    });
  },
  questionDrafts: {},
  setQuestionDraft: (sessionId: string, requestId: string, draft: QuestionDraft): void => {
    set((state: ChatState) => ({
      questionDrafts: {
        ...state.questionDrafts,
        [sessionId]: { ...state.questionDrafts[sessionId], [requestId]: draft },
      },
    }));
  },
  clearQuestionDraft: (sessionId: string, requestId: string): void => {
    set((state: ChatState) => {
      const ofSession: Record<string, QuestionDraft> | undefined = state.questionDrafts[sessionId];
      if (ofSession === undefined || !(requestId in ofSession)) {
        return state;
      }
      const remaining: [string, QuestionDraft][] = Object.entries(ofSession).filter(
        ([id]: [string, QuestionDraft]) => id !== requestId,
      );
      const others: [string, Record<string, QuestionDraft>][] = Object.entries(
        state.questionDrafts,
      ).filter(([id]: [string, Record<string, QuestionDraft>]) => id !== sessionId);
      if (remaining.length === 0) {
        return { questionDrafts: Object.fromEntries(others) };
      }
      return {
        questionDrafts: {
          ...Object.fromEntries(others),
          [sessionId]: Object.fromEntries(remaining),
        },
      };
    });
  },
}));
