import type { ReactElement } from 'react';
import { LockIcon } from '@/features/mcp/McpIcons';
import { McpGroupPlace } from '@/features/mcp/McpGroupPlace';
import { McpToolInspect } from '@/features/mcp/McpToolInspect';
import {
  AUTH_BOX_TEXT,
  AUTH_BOX_TITLE,
  ERROR_BOX_TITLE,
  fixedOrigin,
  NO_ERROR_REASON_TEXT,
  NO_TOOLS_TEXT,
  OFF_NOTE,
  SECRET_MASK,
  SECRET_NOTE,
  toolsTitle,
  transportLong,
} from '@/features/mcp/mcpTexts';
import type { McpRow, McpRowGroup, McpRowStatus, McpSwitchPosition } from '@/features/mcp/mcpTexts';
import type { McpConfigEntry } from '@/lib/bindings/McpConfigEntry';
import type { McpPair } from '@/lib/bindings/McpPair';
import type { McpServer } from '@/lib/bindings/McpServer';
import './McpServerDetails.css';

interface McpServerDetailsProps {
  sessionId: string;
  row: McpRow;
  group: McpRowGroup;
  position: McpSwitchPosition;
  status: McpRowStatus;
  isAgentRunning: boolean;
}

/** Der aufgeklappte Teil einer Zeile: Fehler bzw. Anmeldung, Ablage und Verbindung, dazu Werkzeuge
 *  und Anweisungen auf Anfrage (fest eingebunden: nur die Namen vom Agenten). */
export function McpServerDetails({
  sessionId,
  row,
  group,
  position,
  status,
  isAgentRunning,
}: McpServerDetailsProps): ReactElement {
  function renderProblem(): ReactElement | null {
    if (status === 'failed') {
      const reason: string | null = row.live?.error ?? null;
      return (
        <div className="mcp-details__problem mcp-details__problem--failed">
          <strong className="mcp-details__problem-title">{ERROR_BOX_TITLE}</strong>
          <pre className="mcp-details__problem-reason">
            {reason === null || reason === '' ? NO_ERROR_REASON_TEXT : reason}
          </pre>
        </div>
      );
    }
    if (status === 'needsAuth') {
      return (
        <div className="mcp-details__problem mcp-details__problem--auth">
          <strong className="mcp-details__problem-title">{AUTH_BOX_TITLE}</strong>
          {AUTH_BOX_TEXT}
        </div>
      );
    }
    return null;
  }

  function renderConnection(): ReactElement | null {
    if (row.entry === null) {
      if (row.live === null || row.live.connection === '') {
        return null;
      }
      return (
        <>
          <dt className="mcp-details__term">Verbindung</dt>
          <dd className="mcp-details__value mcp-details__value--mono">{row.live.connection}</dd>
        </>
      );
    }
    return renderEntry(row.entry);
  }

  function renderEntry(entry: McpConfigEntry): ReactElement {
    const isProgram: boolean = entry.transport === 'stdio';
    return (
      <>
        <dt className="mcp-details__term">Art</dt>
        <dd className="mcp-details__value">{transportLong(entry)}</dd>
        <dt className="mcp-details__term">{isProgram ? 'Befehl' : 'Adresse'}</dt>
        <dd className="mcp-details__value mcp-details__value--mono">{entry.target}</dd>
        {entry.pairs.length > 0 && (
          <>
            <dt className="mcp-details__term">{isProgram ? 'Umgebung' : 'Header'}</dt>
            <dd className="mcp-details__value">
              {entry.pairs.map((pair: McpPair) => (
                <div key={pair.key} className="mcp-details__pair">
                  <span className="mcp-details__value--mono">
                    {pair.key}: {pair.value ?? SECRET_MASK}
                  </span>
                  {pair.value === null && <span className="mcp-details__hint">{SECRET_NOTE}</span>}
                </div>
              ))}
            </dd>
          </>
        )}
      </>
    );
  }

  function renderTools(server: McpServer): ReactElement {
    if (server.tools.length === 0) {
      return <p className="mcp-details__hint">{NO_TOOLS_TEXT}</p>;
    }
    return (
      <div className="mcp-details__tools-block">
        <span className="mcp-details__tools-title">{toolsTitle(server.tools.length)}</span>
        <ul className="mcp-details__tools">
          {server.tools.map((tool: string) => (
            <li key={tool} className="mcp-details__tool">
              {tool}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="mcp-details">
      {renderProblem()}
      <dl className="mcp-details__facts">
        <dt className="mcp-details__term">Gespeichert in</dt>
        <dd className="mcp-details__value">
          {group.title} · <McpGroupPlace where={group.where} />
        </dd>
        {renderConnection()}
      </dl>
      {row.sourceId !== null && (
        <McpToolInspect
          sessionId={sessionId}
          sourceId={row.sourceId}
          name={row.name}
          isAgentRunning={isAgentRunning}
        />
      )}
      {row.entry === null && status === 'connected' && row.live !== null && renderTools(row.live)}
      {position !== 'on' && <p className="mcp-details__hint">{OFF_NOTE}</p>}
      {row.entry === null && row.live !== null && (
        <p className="mcp-details__hint">
          <LockIcon /> {fixedOrigin(row.live.scope)} – ändern geht nur dort.
        </p>
      )}
    </div>
  );
}
