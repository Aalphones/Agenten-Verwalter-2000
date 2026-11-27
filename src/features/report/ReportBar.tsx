import { useState } from 'react';
import type { ReactElement } from 'react';
import { Popover } from '@/components/Popover';
import { ReportAcceptToast } from '@/features/report/ReportAcceptToast';
import { ReportIcon } from '@/features/report/ReportIcon';
import type { BarState } from '@/features/report/reportDigest';
import {
  ACCEPT_BLOCKED_TITLE,
  ACCEPT_LABEL,
  ACCEPT_TITLE,
  COMMENTS_LABEL,
  COMMENTS_LIST_LABEL,
  COMMENT_LIST_DESTINATION,
  REPORT_TITLE,
  SEND_LABEL,
  TOC_BUTTON_LABEL,
  sendTitle,
} from '@/features/report/reportTexts';
import type { ReportAccept } from '@/features/report/useReportAccept';
import type { ReportSend } from '@/features/report/useReportSend';
import { ReviewCommentList } from '@/features/review/ReviewCommentList';
import './ReportBar.css';

interface ReportBarProps {
  state: BarState;
  meta: string;
  onOpenToc: () => void;
  /** Schlüssel der gesammelten Kommentare im Store (`reportCommentKey`). */
  commentKey: string;
  /** Nach der Abnahme: weder Kommentare noch Senden. */
  isClosed: boolean;
  send: ReportSend;
  /** Fehlt ohne bereite Abnahme-Station: dann gibt es den Knopf „Abnehmen“ nicht. */
  accept: ReportAccept | null;
}

/** Leiste über dem ganzen Bericht: Titel, Zustand, eine Zeile Stand; rechts Kommentare, Senden und Abnehmen. */
export function ReportBar({
  state,
  meta,
  onOpenToc,
  commentKey,
  isClosed,
  send,
  accept,
}: ReportBarProps): ReactElement {
  const [isListOpen, setIsListOpen] = useState<boolean>(false);
  const hasComments: boolean = send.count > 0;
  const isListShown: boolean = isListOpen && hasComments;
  const errors: string[] = [send.error, accept?.error ?? null].filter(
    (message: string | null): message is string => message !== null,
  );

  function renderCount(): ReactElement | null {
    if (isClosed || !hasComments) {
      return null;
    }
    return (
      <span className="report-bar__comments">
        <button
          type="button"
          className="report-bar__count"
          aria-expanded={isListShown}
          aria-label={`${COMMENTS_LIST_LABEL}: ${String(send.count)}`}
          onClick={(): void => {
            setIsListOpen(!isListShown);
          }}
        >
          <ReportIcon name="msg" />
          {COMMENTS_LABEL}
          <b>{send.count}</b>
        </button>
        {isListShown && (
          <Popover
            label={COMMENTS_LIST_LABEL}
            placement="below"
            align="end"
            width={440}
            detached
            onClose={(): void => {
              setIsListOpen(false);
            }}
          >
            <ReviewCommentList sessionId={commentKey} destination={COMMENT_LIST_DESTINATION} />
          </Popover>
        )}
      </span>
    );
  }

  function renderAccept(): ReactElement | null {
    if (accept === null || isClosed) {
      return null;
    }
    return (
      <button
        type="button"
        className="report-bar__accept"
        disabled={hasComments || accept.isPending}
        title={hasComments ? ACCEPT_BLOCKED_TITLE : ACCEPT_TITLE}
        onClick={accept.accept}
      >
        <ReportIcon name="check" />
        {ACCEPT_LABEL}
      </button>
    );
  }

  return (
    <header className="report-bar">
      <div className="report-bar__title">
        <b>{REPORT_TITLE}</b>
        <span className={`report-bar__state report-bar__state--${state.tone}`}>
          <i className="report-bar__state-dot" />
          {state.label}
        </span>
        <small className="report-bar__meta">{meta}</small>
      </div>
      <button type="button" className="report-bar__toc" onClick={onOpenToc}>
        {TOC_BUTTON_LABEL}
      </button>
      <div className="report-bar__acts">
        {renderCount()}
        {!isClosed && (
          <button
            type="button"
            className="report-bar__send"
            disabled={!hasComments || send.isSending}
            title={sendTitle(send.target === null ? null : send.target.number)}
            onClick={send.send}
          >
            <ReportIcon name="send" />
            {SEND_LABEL}
          </button>
        )}
        {renderAccept()}
      </div>
      {errors.map((message: string) => (
        <p key={message} className="report-bar__error" role="alert">
          {message}
        </p>
      ))}
      {accept !== null && accept.isPending && <ReportAcceptToast onUndo={accept.undo} />}
    </header>
  );
}
