import { create } from 'zustand';

interface ChatState {
  /** Ungesendeter Text der Eingabeleiste je Session. */
  drafts: Record<string, string>;
  setDraft: (sessionId: string, text: string) => void;
  clearDraft: (sessionId: string) => void;
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
}));
