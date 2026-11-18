import type { ReactElement } from 'react';
import { problemLabel } from '@/features/mcp/mcpTexts';
import './McpProblemChip.css';

interface McpProblemChipProps {
  count: number;
  onOpen: () => void;
}

/** Der MCP-Knopf in der Eingabeleiste: immer sichtbar, bei `count > 0` mit rotem Problem-Hinweis. */
export function McpProblemChip({ count, onOpen }: McpProblemChipProps): ReactElement {
  const hasProblems = count > 0;
  return (
    <button type="button" className="mcp-chip" title="MCP-Server anzeigen" onClick={onOpen}>
      <span
        className={hasProblems ? 'mcp-chip__dot' : 'mcp-chip__dot mcp-chip__dot--ok'}
        aria-hidden="true"
      />
      {hasProblems ? problemLabel(count) : 'MCP'}
    </button>
  );
}
