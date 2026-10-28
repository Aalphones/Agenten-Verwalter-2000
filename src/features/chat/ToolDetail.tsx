import type { ReactElement } from 'react';
import type { ToolEntry } from '@/features/chat/buildBlocks';
import type { ToolDetail as ToolDetailType } from '@/lib/bindings/ToolDetail';
import { useToolDetail } from '@/features/chat/useToolDetail';
import type { ToolDetailResult } from '@/features/chat/useToolDetail';
import { useCopyFeedback } from '@/features/background/useCopyFeedback';
import type { CopyState } from '@/features/background/useCopyFeedback';
import './ToolDetail.css';

const SHELL_TOOLS: readonly string[] = ['Bash', 'PowerShell'];
const NOTHING_STORED = 'Für diesen Aufruf wurde nichts gespeichert (älterer Verlauf).';
const NO_OUTPUT = 'Keine Ausgabe.';
const STILL_RUNNING = 'Läuft noch — die Ausgabe erscheint, sobald der Aufruf endet.';
const TRUNCATED_HEAD = 'Gekürzt — nur der Anfang wird gezeigt.';
const TRUNCATED_TAIL = 'Gekürzt — nur das Ende wird gezeigt.';
const COPY_HINT = 'Kopiert den ganzen Text in die Zwischenablage.';
const COPY_LABEL: Record<CopyState, string> = {
  idle: 'Kopieren',
  copied: 'Kopiert',
  failed: 'Fehlgeschlagen',
};

interface ToolDetailProps {
  sessionId: string;
  tool: ToolEntry;
}

interface DetailBlockProps {
  label: string;
  text: string;
  /** Hinweis über dem Text („Gekürzt …“); `null` ohne. */
  notice: string | null;
}

function DetailBlock({ label, text, notice }: DetailBlockProps): ReactElement {
  const copyFeedback = useCopyFeedback();

  return (
    <section className="tool-detail__block">
      <header className="tool-detail__header">
        <h4 className="tool-detail__label">{label}</h4>
        <button
          type="button"
          className="tool-detail__copy"
          title={COPY_HINT}
          onClick={(): void => {
            copyFeedback.copy(text);
          }}
        >
          {COPY_LABEL[copyFeedback.state]}
        </button>
      </header>
      {notice !== null && <p className="tool-detail__notice">{notice}</p>}
      <pre className="tool-detail__text">{text}</pre>
    </section>
  );
}

/** Eingabe und Ausgabe eines aufgeklappten Werkzeug-Aufrufs. Wird nur gerendert, solange der Aufruf offen ist;
 *  erst dann lädt `useToolDetail`. */
export function ToolDetail({ sessionId, tool }: ToolDetailProps): ReactElement {
  const { detail, error }: ToolDetailResult = useToolDetail(sessionId, tool.toolUseId, tool.state);
  const isShell: boolean = SHELL_TOOLS.includes(tool.tool);

  function renderOutput(loadedDetail: ToolDetailType): ReactElement {
    if (tool.state === 'running') {
      return <p className="tool-detail__note">{STILL_RUNNING}</p>;
    }
    if (loadedDetail.output === '') {
      return <p className="tool-detail__note">{NO_OUTPUT}</p>;
    }
    let notice: string | null = null;
    if (loadedDetail.outputTruncated) {
      notice = isShell ? TRUNCATED_TAIL : TRUNCATED_HEAD;
    }
    return <DetailBlock label="Ausgabe" text={loadedDetail.output} notice={notice} />;
  }

  function renderBody(): ReactElement {
    if (detail === null) {
      if (error !== null) {
        return <p className="tool-detail__note">{error}</p>;
      }
      return <p className="tool-detail__note">Lädt …</p>;
    }
    if (detail.missing) {
      return <p className="tool-detail__note">{NOTHING_STORED}</p>;
    }
    return (
      <>
        <DetailBlock
          label={isShell ? 'Befehl' : 'Eingabe'}
          text={detail.input}
          notice={detail.inputTruncated ? TRUNCATED_HEAD : null}
        />
        {renderOutput(detail)}
        {error !== null && <p className="tool-detail__note">{error}</p>}
      </>
    );
  }

  return <div className="tool-detail">{renderBody()}</div>;
}
