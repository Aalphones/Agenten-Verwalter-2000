import { useCallback, useMemo, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ReportComposer } from '@/features/report/ReportComposer';
import {
  ReportCommentsContext,
  type Anchor,
  type ComposerRequest,
  type ReportCommentsValue,
} from '@/features/report/reportCommentsContext';
import { NO_COMMENTS, reportCommentKey, useReviewStore } from '@/stores/review';
import type { CollectedComment } from '@/stores/review';

interface OpenComposer {
  anchor: Anchor;
  request: ComposerRequest;
}

interface ReportCommentsProviderProps {
  implementationId: string;
  /** Aus nach der Abnahme: dann gibt es weder Knöpfe noch ein Kommentarfeld. */
  isEnabled: boolean;
  children: ReactNode;
}

/** Hält die gesammelten Kommentare des Berichts (Store, `report:<Umsetzung>`) und das eine offene Kommentarfeld. */
export function ReportCommentsProvider({
  implementationId,
  isEnabled,
  children,
}: ReportCommentsProviderProps): ReactElement {
  const storeKey: string = reportCommentKey(implementationId);
  const comments: readonly CollectedComment[] = useReviewStore(
    (state) => state.collected[storeKey] ?? NO_COMMENTS,
  );
  const upsert = useReviewStore((state) => state.upsert);
  const removeFromStore = useReviewStore((state) => state.remove);
  const [composer, setComposer] = useState<OpenComposer | null>(null);
  const activeComposer: OpenComposer | null = isEnabled ? composer : null;

  const open = useCallback((anchor: Anchor, request: ComposerRequest): void => {
    setComposer({ anchor, request });
  }, []);
  const closeComposer = useCallback((): void => {
    setComposer(null);
  }, []);
  const remove = useCallback(
    (id: string): void => {
      removeFromStore(storeKey, id);
    },
    [removeFromStore, storeKey],
  );

  const pendingPreview = activeComposer?.request.preview ?? null;
  const isComposerOpen: boolean = activeComposer !== null;
  const value: ReportCommentsValue = useMemo(
    () => ({
      implementationId,
      isEnabled,
      comments,
      isComposerOpen,
      pendingPreview,
      open,
      closeComposer,
      remove,
    }),
    [
      implementationId,
      isEnabled,
      comments,
      isComposerOpen,
      pendingPreview,
      open,
      closeComposer,
      remove,
    ],
  );

  function submit(request: ComposerRequest, text: string): void {
    if (text === '') {
      return;
    }
    upsert(storeKey, request.lineId, request.build(text));
    setComposer(null);
  }

  return (
    <ReportCommentsContext.Provider value={value}>
      {children}
      {activeComposer !== null &&
        createPortal(
          <ReportComposer
            key={activeComposer.request.lineId}
            anchor={activeComposer.anchor}
            where={activeComposer.request.where}
            initialText={activeComposer.request.initialText}
            onSubmit={(text: string): void => {
              submit(activeComposer.request, text);
            }}
            onCancel={closeComposer}
          />,
          document.body,
        )}
    </ReportCommentsContext.Provider>
  );
}
