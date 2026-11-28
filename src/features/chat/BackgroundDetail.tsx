import { useState } from 'react';
import type { ReactElement } from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { formatDuration, stateLabel, stateTone } from '@/features/background/backgroundLabels';
import { OutputPane } from '@/features/background/OutputPane';
import { outputNotice } from '@/features/background/outputNotice';
import { useCopyFeedback } from '@/features/background/useCopyFeedback';
import type { CopyState } from '@/features/background/useCopyFeedback';
import { useItemOutput } from '@/features/background/useItemOutput';
import { useNow } from '@/features/background/useNow';
import { SubagentTrail } from '@/features/chat/SubagentTrail';
import { trailText } from '@/features/chat/subagentTrailContent';
import type { BackgroundItem } from '@/lib/bindings/BackgroundItem';
import { stopBackgroundItem } from '@/lib/background';
import { commandErrorText } from '@/lib/errors';
import { useSessionErrorsStore } from '@/stores/sessionErrors';
import './BackgroundDetail.css';

const LOADING = 'Lädt …';
const NO_OUTPUT_YET = 'Noch keine Ausgabe.';
const NO_OUTPUT = 'Keine Ausgabe.';
const COPY_LABEL: Record<CopyState, string> = {
  idle: 'Ausgabe kopieren',
  copied: 'Kopiert',
  failed: 'Fehlgeschlagen',
};

interface BackgroundDetailProps {
  sessionId: string;
  item: BackgroundItem;
}

/** Inhalt einer aufgeklappten Verlaufszeile. Wird nur gerendert, solange die Zeile offen ist; damit endet auch
 *  das Nachladen der Ausgabe. */
export function BackgroundDetail({ sessionId, item }: BackgroundDetailProps): ReactElement {
  const [isStopRequested, setIsStopRequested] = useState<boolean>(false);
  const isRunning: boolean = item.state === 'running';
  const isSubagent: boolean = item.kind === 'subagent';
  const now: number = useNow(isRunning);
  const { preview, error: outputError } = useItemOutput(sessionId, item);
  const copyFeedback = useCopyFeedback();
  const reportError = useSessionErrorsStore((state) => state.report);

  const copyText: string = isSubagent ? trailText(item) : (preview?.text ?? '');
  const canStop: boolean = isRunning && item.kind !== 'command';
  const isStopping: boolean = canStop && isStopRequested;
  const address: string | null = item.url;

  function run(action: () => Promise<void>, prefix: string, onFailure?: () => void): void {
    action().catch((reason: unknown) => {
      console.error(prefix, reason);
      reportError(sessionId, `${prefix}: ${commandErrorText(reason)}`);
      onFailure?.();
    });
  }

  function renderTiming(): ReactElement | null {
    if (isRunning) {
      return <span>seit {formatDuration(now - item.startedAt)}</span>;
    }
    if (item.endedAt === null) {
      return null;
    }
    return <span>nach {formatDuration(item.endedAt - item.startedAt)}</span>;
  }

  function renderState(): ReactElement {
    return (
      <div className="background-detail__state">
        <b
          className={`background-detail__label background-detail__label--${stateTone(item.state)}`}
        >
          {stateLabel(item.state)}
        </b>
        {renderTiming()}
        {item.exitCode !== null && <span>Exit-Code {String(item.exitCode)}</span>}
        {isRunning && item.kind !== 'command' && (
          <span className="background-detail__live">
            <span className="background-detail__pulse" aria-hidden="true" />
            {isSubagent ? 'Schritte live' : 'Ausgabe live'}
          </span>
        )}
        {isSubagent && item.model !== null && <span>{item.model}</span>}
      </div>
    );
  }

  function emptyNotice(): string | null {
    if (preview === null) {
      return LOADING;
    }
    if (preview.text !== '' || preview.missing) {
      return null;
    }
    return isRunning ? NO_OUTPUT_YET : NO_OUTPUT;
  }

  function renderOutput(): ReactElement {
    if (isSubagent) {
      return <SubagentTrail item={item} />;
    }
    return (
      <OutputPane
        text={preview?.text ?? ''}
        notice={outputError ?? outputNotice(preview, item.state) ?? emptyNotice()}
        followsEnd={isRunning}
      />
    );
  }

  return (
    <div className="background-detail">
      {renderState()}
      {renderOutput()}
      <div className="background-detail__actions">
        {canStop && (
          <button
            type="button"
            className="background-detail__action background-detail__action--danger"
            title="Hält den Prozess an. Der Agent erfährt davon."
            disabled={isStopping}
            onClick={(): void => {
              setIsStopRequested(true);
              run(
                () => stopBackgroundItem(sessionId, item.id),
                'Beenden fehlgeschlagen',
                (): void => {
                  setIsStopRequested(false);
                },
              );
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <rect x="3" y="3" width="8" height="8" rx="1.2" fill="currentColor" />
            </svg>
            {isStopping ? 'Wird beendet …' : 'Beenden'}
          </button>
        )}
        {address !== null && (
          <button
            type="button"
            className="background-detail__action"
            title="Öffnet die Adresse im Standardbrowser."
            onClick={(): void => {
              run(() => openUrl(address), 'Öffnen im Browser fehlgeschlagen');
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
              aria-hidden="true"
            >
              <path d="M8 2h4v4M12 2 6.5 7.5M10.5 8.5V12h-8.5V3.5H5.5" />
            </svg>
            Im Browser öffnen
          </button>
        )}
        <button
          type="button"
          className="background-detail__action"
          title="Kopiert die Ausgabe in die Zwischenablage."
          disabled={copyText === ''}
          onClick={(): void => {
            copyFeedback.copy(copyText);
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            aria-hidden="true"
          >
            <rect x="4.5" y="4.5" width="7.5" height="7.5" rx="1.2" />
            <path d="M9.5 4.5V2.5a.8.8 0 0 0-.8-.8H2.5a.8.8 0 0 0-.8.8v6.2c0 .4.4.8.8.8h2" />
          </svg>
          {COPY_LABEL[copyFeedback.state]}
        </button>
      </div>
    </div>
  );
}
