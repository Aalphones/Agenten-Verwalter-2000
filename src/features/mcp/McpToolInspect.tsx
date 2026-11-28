import { useState } from 'react';
import type { ReactElement } from 'react';
import { ClockIcon } from '@/features/mcp/McpIcons';
import {
  INSPECT_LABEL,
  INSPECT_OFFLINE_NOTE,
  INSPECT_RETRY,
  INSPECT_RUNNING,
  INSTRUCTIONS_TITLE,
  NO_DESCRIPTION,
  NO_INSTRUCTIONS,
} from '@/features/mcp/mcpFormTexts';
import { ERROR_BOX_TITLE, NO_TOOLS_TEXT, toolsTitle } from '@/features/mcp/mcpTexts';
import type { McpProbeResult } from '@/lib/bindings/McpProbeResult';
import type { McpToolInfo } from '@/lib/bindings/McpToolInfo';
import { commandErrorText } from '@/lib/errors';
import { inspectMcpServer } from '@/lib/mcp';
import './McpToolInspect.css';

type InspectState = { phase: 'running' } | { phase: 'done'; result: McpProbeResult } | null;

interface McpToolInspectProps {
  sessionId: string;
  sourceId: string;
  name: string;
  isAgentRunning: boolean;
}

/** „Werkzeuge & Anweisungen ansehen“: fragt den gespeicherten Server selbst, auch ohne Agenten. */
export function McpToolInspect({
  sessionId,
  sourceId,
  name,
  isAgentRunning,
}: McpToolInspectProps): ReactElement {
  const [inspect, setInspect] = useState<InspectState>(null);

  function load(): void {
    setInspect({ phase: 'running' });
    inspectMcpServer(sessionId, sourceId, name)
      .then((result: McpProbeResult) => {
        setInspect({ phase: 'done', result });
      })
      .catch((reason: unknown) => {
        const error: string = commandErrorText(reason);
        setInspect({ phase: 'done', result: { tools: [], instructions: null, error } });
      });
  }

  if (inspect === null) {
    return (
      <div className="mcp-inspect__start">
        <button
          type="button"
          className="mcp-dialog__button mcp-dialog__button--small"
          onClick={load}
        >
          {INSPECT_LABEL}
        </button>
        {!isAgentRunning && <span className="mcp-inspect__note">{INSPECT_OFFLINE_NOTE}</span>}
      </div>
    );
  }
  if (inspect.phase === 'running') {
    return (
      <span className="mcp-inspect__running" role="status">
        <ClockIcon />
        {INSPECT_RUNNING}
      </span>
    );
  }

  const { result } = inspect;
  if (result.error !== null) {
    return (
      <div className="mcp-inspect__failure" role="alert">
        <strong>{ERROR_BOX_TITLE}</strong>
        <pre className="mcp-inspect__reason">{result.error}</pre>
        <button
          type="button"
          className="mcp-dialog__button mcp-dialog__button--small"
          onClick={load}
        >
          {INSPECT_RETRY}
        </button>
      </div>
    );
  }
  return (
    <div className="mcp-inspect">
      <span className="mcp-inspect__title">{INSTRUCTIONS_TITLE}</span>
      <p className="mcp-inspect__instructions">{result.instructions ?? NO_INSTRUCTIONS}</p>
      <span className="mcp-inspect__title">{toolsTitle(result.tools.length)}</span>
      {result.tools.length === 0 && <p className="mcp-inspect__note">{NO_TOOLS_TEXT}</p>}
      {result.tools.length > 0 && (
        <ul className="mcp-inspect__tools">
          {result.tools.map((tool: McpToolInfo) => (
            <li key={tool.name} className="mcp-inspect__tool">
              <details>
                <summary className="mcp-inspect__tool-name">{tool.name}</summary>
                <p className="mcp-inspect__tool-text">
                  {tool.description === '' ? NO_DESCRIPTION : tool.description}
                </p>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
