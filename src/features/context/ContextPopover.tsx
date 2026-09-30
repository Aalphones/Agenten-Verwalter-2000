import type { ReactElement } from 'react';
import { Popover } from '@/components/Popover';
import { categoryLabel } from '@/features/context/categoryLabels';
import {
  formatClock,
  formatPercent,
  formatThousands,
  formatTokens,
} from '@/features/context/formatTokens';
import { useSessionContext } from '@/features/context/useSessionContext';
import type { ContextBreakdown } from '@/lib/bindings/ContextBreakdown';
import type { ContextCategory } from '@/lib/bindings/ContextCategory';
import type { ContextFile } from '@/lib/bindings/ContextFile';
import type { SessionContext } from '@/lib/bindings/SessionContext';
import type { SessionSummary } from '@/lib/bindings/SessionSummary';
import { refreshContext } from '@/lib/context';
import './ContextPopover.css';

const CONTEXT_POPOVER_WIDTH = 360;
const CHART_COLOR_COUNT = 7;
const PATH_MAX_LENGTH = 48;
const PERCENT_FACTOR = 100;

const COMPACT_TITLE = 'Ab hier fasst Claude den bisherigen Verlauf zusammen, um Platz zu schaffen.';

interface ContextPopoverProps {
  session: SessionSummary;
  onClose: () => void;
}

interface CategoryRow {
  category: ContextCategory;
  /** 1 bis 7 für belegte Kategorien, `null` für den freien Platz. */
  colorIndex: number | null;
}

export function ContextPopover({ session, onClose }: ContextPopoverProps): ReactElement {
  const context: SessionContext | null = useSessionContext(session.id, true);

  function refresh(): void {
    // Die Antwort kommt als `context://changed`; hier gibt es nichts abzuwarten.
    refreshContext(session.id).catch((reason: unknown) => {
      console.error('Kontext nicht anfragbar', reason);
    });
  }

  function renderBody(): ReactElement {
    if (context === null || context.breakdown === null) {
      return renderWithoutBreakdown(context);
    }
    return renderBreakdown(context.breakdown, context.isAgentRunning, refresh);
  }

  function renderWithoutBreakdown(loaded: SessionContext | null): ReactElement {
    const hint: string =
      loaded === null || loaded.isAgentRunning
        ? 'Aufschlüsselung wird geladen …'
        : 'Die Aufschlüsselung kommt mit der nächsten Antwort des Agenten.';
    return (
      <>
        <p className="context-popover__summary">
          {formatThousands(session.contextUsed)} von {formatThousands(session.contextWindow)} Tokens
          belegt
        </p>
        <p className="context-popover__hint">{hint}</p>
      </>
    );
  }

  return (
    <Popover
      label="Kontext"
      placement="below"
      align="end"
      width={CONTEXT_POPOVER_WIDTH}
      onClose={onClose}
    >
      <div className="context-popover">
        <h2 className="context-popover__title">Kontext</h2>
        {renderBody()}
      </div>
    </Popover>
  );
}

function renderBreakdown(
  breakdown: ContextBreakdown,
  isAgentRunning: boolean,
  onRefresh: () => void,
): ReactElement {
  const rows: CategoryRow[] = buildRows(breakdown.categories);
  const usedPercent: number = shareOfWindow(breakdown.totalTokens, breakdown.maxTokens);

  return (
    <>
      <p className="context-popover__model">{breakdown.model}</p>
      <p className="context-popover__summary">
        {formatTokens(breakdown.totalTokens)} / {formatTokens(breakdown.maxTokens)} Tokens (
        {formatPercent(usedPercent, 0)})
      </p>
      {renderStack(breakdown, rows)}
      {renderTable(breakdown, rows)}
      {breakdown.autoCompactThreshold !== null && (
        <p className="context-popover__compact" title={COMPACT_TITLE}>
          <InfoIcon />
          Automatisches Zusammenfassen ab {formatTokens(breakdown.autoCompactThreshold)} Tokens
        </p>
      )}
      {breakdown.memoryFiles.length > 0 && renderMemoryFiles(breakdown.memoryFiles)}
      {renderFoot(breakdown, isAgentRunning, onRefresh)}
    </>
  );
}

function renderStack(breakdown: ContextBreakdown, rows: readonly CategoryRow[]): ReactElement {
  return (
    <div className="context-popover__stack" aria-hidden="true">
      {rows.map((row: CategoryRow) => {
        if (row.colorIndex === null) {
          return null;
        }
        return (
          <span
            key={row.category.name}
            className={`context-popover__segment context-popover__chart--${String(row.colorIndex)}`}
            style={{
              width: `${String(
                Math.min(shareOfWindow(row.category.tokens, breakdown.maxTokens), PERCENT_FACTOR),
              )}%`,
            }}
          />
        );
      })}
      {breakdown.autoCompactThreshold !== null && (
        <span
          className="context-popover__threshold"
          style={{
            left: `${String(shareOfWindow(breakdown.autoCompactThreshold, breakdown.maxTokens))}%`,
          }}
        />
      )}
    </div>
  );
}

function renderTable(breakdown: ContextBreakdown, rows: readonly CategoryRow[]): ReactElement {
  return (
    <table className="context-popover__table">
      <thead>
        <tr>
          <th scope="col">Kategorie</th>
          <th scope="col" className="context-popover__number">
            Tokens
          </th>
          <th scope="col" className="context-popover__number">
            Anteil
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row: CategoryRow) => (
          <tr key={row.category.name}>
            <td>
              <span
                className={`context-popover__dot${
                  row.colorIndex === null
                    ? ' context-popover__dot--free'
                    : ` context-popover__chart--${String(row.colorIndex)}`
                }`}
              />
              {categoryLabel(row.category.name)}
            </td>
            <td className="context-popover__number">{formatTokens(row.category.tokens)}</td>
            <td className="context-popover__number">
              {formatPercent(shareOfWindow(row.category.tokens, breakdown.maxTokens), 1)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function renderMemoryFiles(files: readonly ContextFile[]): ReactElement {
  return (
    <section className="context-popover__files">
      <h3 className="context-popover__subtitle">Memory-Dateien</h3>
      <ul className="context-popover__file-list">
        {files.map((file: ContextFile) => (
          <li key={file.path} className="context-popover__file">
            <span className="context-popover__path" title={file.path}>
              {shortenPath(file.path)}
            </span>
            <span className="context-popover__number">{formatTokens(file.tokens)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function renderFoot(
  breakdown: ContextBreakdown,
  isAgentRunning: boolean,
  onRefresh: () => void,
): ReactElement {
  return (
    <div className="context-popover__foot">
      <span>
        Stand {formatClock(breakdown.fetchedAt)}
        {!isAgentRunning && ' · Agent ruht'}
      </span>
      {isAgentRunning && (
        <button type="button" className="context-popover__refresh" onClick={onRefresh}>
          Aktualisieren
        </button>
      )}
    </div>
  );
}

/** Belegte Kategorien bekommen der Reihe nach eine der sieben Diagrammfarben (ab der achten von vorn). */
function buildRows(categories: readonly ContextCategory[]): CategoryRow[] {
  let usedCount = 0;
  return categories.map((category: ContextCategory): CategoryRow => {
    if (category.isFree) {
      return { category, colorIndex: null };
    }
    const colorIndex: number = (usedCount % CHART_COLOR_COUNT) + 1;
    usedCount += 1;
    return { category, colorIndex };
  });
}

function shareOfWindow(tokens: number, maxTokens: number): number {
  if (maxTokens === 0) {
    return 0;
  }
  return (tokens / maxTokens) * PERCENT_FACTOR;
}

/** Lange Pfade behalten ihr Ende: „…“ plus die letzten 47 Zeichen. */
function shortenPath(path: string): string {
  if (path.length <= PATH_MAX_LENGTH) {
    return path;
  }
  return `…${path.slice(-(PATH_MAX_LENGTH - 1))}`;
}

function InfoIcon(): ReactElement {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="7" cy="7" r="5.5" />
      <path d="M7 6.3v3.4M7 4.3v.1" />
    </svg>
  );
}
