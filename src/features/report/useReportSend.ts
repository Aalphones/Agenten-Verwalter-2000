import { useCallback, useMemo, useRef, useState } from 'react';
import { reportTargetSession } from '@/features/report/reportTarget';
import { SEND_TEXT } from '@/features/report/reportTexts';
import type { InquiryCreated } from '@/lib/bindings/InquiryCreated';
import type { ReviewComment } from '@/lib/bindings/ReviewComment';
import type { SessionSummary } from '@/lib/bindings/SessionSummary';
import { sendMessage } from '@/lib/chat';
import { createInquiry } from '@/lib/implementation';
import { useActionError } from '@/lib/useActionError';
import { NO_COMMENTS, reportCommentKey, useReviewStore } from '@/stores/review';
import type { CollectedComment } from '@/stores/review';
import { useSessionsStore } from '@/stores/sessions';

const SEND_FAILED_PREFIX = 'Kommentare senden fehlgeschlagen';

export interface ReportSend {
  /** Die Rückfrage, die die Kommentare bekommt; `null`: „Kommentare senden“ legt eine an. */
  target: SessionSummary | null;
  count: number;
  isSending: boolean;
  /** Fehlersatz der letzten Sendung; die Kommentare bleiben dann gesammelt. */
  error: string | null;
  send: () => void;
}

/**
 * „Kommentare senden“ im Review-Bericht: schickt die gesammelten Kommentare als Review-Kommentare an die
 * Rückfrage der Umsetzung (ADR 048), legt sie bei Bedarf an und öffnet sie danach.
 */
export function useReportSend(
  implementationId: string,
  sessions: readonly SessionSummary[],
  onSessionCreated: (created: SessionSummary) => void,
): ReportSend {
  const storeKey: string = reportCommentKey(implementationId);
  const collected: readonly CollectedComment[] = useReviewStore(
    (state) => state.collected[storeKey] ?? NO_COMMENTS,
  );
  const clearIds = useReviewStore((state) => state.clearIds);
  const selectSession = useSessionsStore((state) => state.selectSession);
  const [isSending, setIsSending] = useState<boolean>(false);
  /** Eine angelegte Rückfrage, deren Nachricht scheiterte: der nächste Versuch nimmt sie, statt noch eine anzulegen. */
  const unsentInquiry = useRef<InquiryCreated | null>(null);
  const { error, run } = useActionError(storeKey);
  const target: SessionSummary | null = useMemo(
    () => reportTargetSession(sessions, implementationId),
    [sessions, implementationId],
  );

  const send = useCallback((): void => {
    if (isSending || collected.length === 0) {
      return;
    }
    const sent: readonly CollectedComment[] = collected;
    const comments: ReviewComment[] = sent.map((entry: CollectedComment) => entry.comment);
    setIsSending(true);
    run(async (): Promise<void> => {
      try {
        let created: InquiryCreated | null = null;
        let sessionId: string;
        let attachmentIds: string[] = [];
        if (target === null) {
          created = unsentInquiry.current ?? (await createInquiry(implementationId));
          unsentInquiry.current = created;
          sessionId = created.session.id;
          attachmentIds = [created.attachment.id];
        } else {
          sessionId = target.id;
        }
        await sendMessage(sessionId, SEND_TEXT, attachmentIds, comments);
        unsentInquiry.current = null;
        clearIds(
          storeKey,
          sent.map((entry: CollectedComment) => entry.id),
        );
        if (created === null) {
          selectSession(sessionId);
        } else {
          onSessionCreated(created.session);
        }
      } finally {
        setIsSending(false);
      }
    }, SEND_FAILED_PREFIX);
  }, [
    isSending,
    collected,
    run,
    target,
    implementationId,
    clearIds,
    storeKey,
    selectSession,
    onSessionCreated,
  ]);

  return { target, count: collected.length, isSending, error, send };
}
