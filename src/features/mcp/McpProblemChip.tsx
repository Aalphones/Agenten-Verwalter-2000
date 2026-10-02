import type { ReactElement } from 'react';
import { problemLabel } from '@/features/mcp/mcpTexts';
import './McpProblemChip.css';

interface McpProblemChipProps {
  count: number;
  onOpen: () => void;
}

/** Der Hinweis in der Eingabeleiste; wer ihn zeigt, entscheidet über `count > 0`. */
export function McpProblemChip({ count, onOpen }: McpProblemChipProps): ReactElement {
  return (
    <button type="button" className="mcp-chip" title="MCP-Server anzeigen" onClick={onOpen}>
      <span className="mcp-chip__dot" aria-hidden="true" />
      {problemLabel(count)}
    </button>
  );
}
