import { useState } from 'react';
import type { ReactElement } from 'react';
import { Switch } from '@/components/Switch';
import {
  blockingStation,
  mayDelete,
  type StationRef,
} from '@/features/implementation/implementationOrder';
import {
  AUTO_START_LABEL,
  AUTO_START_TITLE,
  blockedText,
  CANCEL_LABEL,
  CANCEL_TITLE,
  cancelledText,
  cancelQuestion,
  CONFIRM_BACK_LABEL,
  CONFIRM_CANCEL_LABEL,
  CONFIRM_DELETE_LABEL,
  DELETE_LABEL,
  DELETE_TITLE,
  deleteQuestion,
  INQUIRY_LABEL,
  INQUIRY_TITLE,
  progressLine,
  REPORT_LABEL,
  REPORT_TITLE,
  STOP_AFTER_LABEL,
  STOP_AFTER_TITLE,
} from '@/features/implementation/implementationTexts';
import type { ImplementationView } from '@/lib/bindings/ImplementationView';
import './ImplementationBar.css';

interface ImplementationBarProps {
  implementation: ImplementationView;
  /** Der Lagebericht ist geöffnet. */
  isReportShown: boolean;
  /** „Neue Rückfrage“ legt gerade die Session an. */
  isInquiryBusy: boolean;
  /** Der Lagebericht wird gerade erstellt. */
  isReportBusy: boolean;
  onSetAutoStart: (enabled: boolean) => void;
  onSetStopAfterCurrent: (enabled: boolean) => void;
  onNewInquiry: () => void;
  onOpenReport: () => void;
  onCancel: () => void;
  onDelete: () => void;
}

/** Rückfrage, die gerade in der Leiste steht. */
type Confirm = 'cancel' | 'delete';

/** Zeile unter der Kopfzeile: Fortschritt, die Schalter der Automatik, Rückfrage und Lagebericht. */
export function ImplementationBar({
  implementation,
  isReportShown,
  isInquiryBusy,
  isReportBusy,
  onSetAutoStart,
  onSetStopAfterCurrent,
  onNewInquiry,
  onOpenReport,
  onCancel,
  onDelete,
}: ImplementationBarProps): ReactElement {
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const share: number =
    implementation.stationsTotal === 0
      ? 0
      : (implementation.stationsDone / implementation.stationsTotal) * 100;
  const cancelledAt: number | null = implementation.cancelledAt;
  const isCancelled: boolean = cancelledAt !== null;
  const isOpen: boolean = implementation.finishedAt === null;
  const blocking: StationRef | undefined = blockingStation(implementation);
  const blockTitle: string | undefined =
    blocking === undefined ? undefined : blockedText(blocking.phase.key, blocking.station.stage);
  const canDelete: boolean = mayDelete(implementation);
  // Eine Rückfrage, die nicht mehr gilt (Station läuft inzwischen, Umsetzung abgeschlossen), fällt weg.
  const shownConfirm: Confirm | null =
    confirm === 'cancel' && isOpen && blocking === undefined
      ? 'cancel'
      : confirm === 'delete' && canDelete && blocking === undefined
        ? 'delete'
        : null;

  function renderConfirm(kind: Confirm): ReactElement {
    const isCancel: boolean = kind === 'cancel';
    return (
      <span className="implementation-bar__confirm" role="group" aria-label="Rückfrage">
        <span>
          {isCancel ? cancelQuestion(implementation.name) : deleteQuestion(implementation.name)}
        </span>
        <button
          type="button"
          className="implementation-bar__button implementation-bar__button--danger"
          onClick={(): void => {
            setConfirm(null);
            if (isCancel) {
              onCancel();
            } else {
              onDelete();
            }
          }}
        >
          {isCancel ? CONFIRM_CANCEL_LABEL : CONFIRM_DELETE_LABEL}
        </button>
        <button
          type="button"
          className="implementation-bar__button"
          onClick={(): void => {
            setConfirm(null);
          }}
        >
          {CONFIRM_BACK_LABEL}
        </button>
      </span>
    );
  }

  return (
    <div className="implementation-bar">
      <span>{progressLine(implementation)}</span>
      <span
        className="implementation-bar__progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={implementation.stationsTotal}
        aria-valuenow={implementation.stationsDone}
        aria-label="Fertige Sessions"
      >
        <i style={{ width: `${String(share)}%` }} />
      </span>
      <span className="implementation-bar__spacer" />
      {cancelledAt === null ? (
        <span className="implementation-bar__switch">
          {AUTO_START_LABEL}
          <Switch
            checked={implementation.autoStart}
            label={AUTO_START_LABEL}
            title={AUTO_START_TITLE}
            onChange={onSetAutoStart}
          />
        </span>
      ) : (
        <span className="implementation-bar__cancelled">{cancelledText(cancelledAt)}</span>
      )}
      <span className="implementation-bar__actions">
        {!isCancelled && (
          <button
            type="button"
            className="implementation-bar__button"
            aria-pressed={implementation.stopAfterCurrent}
            title={STOP_AFTER_TITLE}
            onClick={(): void => {
              onSetStopAfterCurrent(!implementation.stopAfterCurrent);
            }}
          >
            {STOP_AFTER_LABEL}
          </button>
        )}
        <button
          type="button"
          className="implementation-bar__button"
          aria-busy={isInquiryBusy}
          disabled={isInquiryBusy}
          title={INQUIRY_TITLE}
          onClick={onNewInquiry}
        >
          {isInquiryBusy && <span className="implementation-bar__spinner" aria-hidden="true" />}
          {INQUIRY_LABEL}
        </button>
        <button
          type="button"
          className="implementation-bar__button"
          aria-busy={isReportBusy}
          aria-pressed={isReportShown}
          disabled={isReportBusy}
          title={REPORT_TITLE}
          onClick={onOpenReport}
        >
          {isReportBusy && <span className="implementation-bar__spinner" aria-hidden="true" />}
          {REPORT_LABEL}
        </button>
        {isOpen && (
          <button
            type="button"
            className="implementation-bar__button"
            aria-pressed={shownConfirm === 'cancel'}
            disabled={blocking !== undefined}
            title={blockTitle ?? CANCEL_TITLE}
            onClick={(): void => {
              setConfirm('cancel');
            }}
          >
            {CANCEL_LABEL}
          </button>
        )}
        {canDelete && (
          <button
            type="button"
            className="implementation-bar__button"
            aria-pressed={shownConfirm === 'delete'}
            disabled={blocking !== undefined}
            title={blockTitle ?? DELETE_TITLE}
            onClick={(): void => {
              setConfirm('delete');
            }}
          >
            {DELETE_LABEL}
          </button>
        )}
      </span>
      {shownConfirm !== null && renderConfirm(shownConfirm)}
    </div>
  );
}
