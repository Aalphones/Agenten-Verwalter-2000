import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { REPORT_LABEL, REPORT_LOADING } from '@/features/implementation/implementationTexts';
import type { ImplementationView } from '@/lib/bindings/ImplementationView';
import { commandErrorText } from '@/lib/errors';
import { loadImplementationReport } from '@/lib/implementation';
import './ReportPanel.css';

interface ReportPanelProps {
  implementation: ImplementationView;
}

type Report = { kind: 'text'; text: string } | { kind: 'error'; message: string };

/** Der Lagebericht als Text, derselbe, den der Agent über `implementation_get` liest. */
export function ReportPanel({ implementation }: ReportPanelProps): ReactElement {
  const [report, setReport] = useState<Report | null>(null);
  // Jede neue Ansicht aus dem Core kann einen anderen Stand tragen; dann kommt der Text neu.
  const stand = `${String(implementation.lastActivityAt)}:${String(implementation.stationsDone)}:${implementation.urgency}`;

  useEffect(() => {
    const controller = new AbortController();
    loadImplementationReport(implementation.id)
      .then((text: string) => {
        if (!controller.signal.aborted) {
          setReport({ kind: 'text', text });
        }
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setReport({
            kind: 'error',
            message: `Lagebericht nicht ladbar: ${commandErrorText(reason)}`,
          });
        }
      });
    return (): void => {
      controller.abort();
    };
  }, [implementation.id, stand]);

  function renderBody(): ReactElement {
    if (report === null) {
      return <p className="report-panel__loading">{REPORT_LOADING}</p>;
    }
    if (report.kind === 'error') {
      return (
        <p className="report-panel__error" role="alert">
          {report.message}
        </p>
      );
    }
    return (
      <pre className="report-panel__text" role="document" aria-label={REPORT_LABEL}>
        {report.text}
      </pre>
    );
  }

  return (
    <section className="report-panel" aria-label={REPORT_LABEL}>
      <h2 className="report-panel__title">{REPORT_LABEL}</h2>
      {renderBody()}
    </section>
  );
}
