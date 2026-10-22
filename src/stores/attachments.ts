import { create } from 'zustand';
import type { Attachment } from '@/lib/bindings/Attachment';

/** Schlüssel der Anhänge, die unter „Neue Session“ noch keine Session haben. */
export const NEW_SESSION_KEY = 'new-session';

export interface OpenViewer {
  sessionId: string;
  attachment: Attachment;
}

interface AttachmentsState {
  /** Noch nicht gesendete Anhänge je Session-ID bzw. `NEW_SESSION_KEY`. */
  pending: Record<string, Attachment[]>;
  /** Bild, dessen Bildansicht gerade offen ist. */
  viewer: OpenViewer | null;
  openViewer: (sessionId: string, attachment: Attachment) => void;
  closeViewer: () => void;
  add: (key: string, attachments: readonly Attachment[]) => void;
  remove: (key: string, attachmentId: string) => void;
  clear: (key: string) => void;
  /** Entfernt nur die genannten Anhänge; später Dazugekommene bleiben. */
  clearIds: (key: string, attachmentIds: readonly string[]) => void;
}

export const useAttachmentsStore = create<AttachmentsState>((set) => ({
  pending: {},
  viewer: null,
  openViewer: (sessionId: string, attachment: Attachment): void => {
    set({ viewer: { sessionId, attachment } });
  },
  closeViewer: (): void => {
    set({ viewer: null });
  },
  add: (key: string, attachments: readonly Attachment[]): void => {
    set((state: AttachmentsState) => ({
      pending: { ...state.pending, [key]: [...(state.pending[key] ?? []), ...attachments] },
    }));
  },
  remove: (key: string, attachmentId: string): void => {
    set((state: AttachmentsState) => ({
      pending: {
        ...state.pending,
        [key]: (state.pending[key] ?? []).filter(
          (attachment: Attachment) => attachment.id !== attachmentId,
        ),
      },
    }));
  },
  clear: (key: string): void => {
    set((state: AttachmentsState) => {
      const remaining: [string, Attachment[]][] = Object.entries(state.pending).filter(
        ([entryKey]: [string, Attachment[]]) => entryKey !== key,
      );
      return { pending: Object.fromEntries(remaining) };
    });
  },
  clearIds: (key: string, attachmentIds: readonly string[]): void => {
    set((state: AttachmentsState) => ({
      pending: {
        ...state.pending,
        [key]: (state.pending[key] ?? []).filter(
          (attachment: Attachment) => !attachmentIds.includes(attachment.id),
        ),
      },
    }));
  },
}));
