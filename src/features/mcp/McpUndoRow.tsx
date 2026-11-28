import type { CSSProperties, ReactElement } from 'react';
import { UNDO_LABEL, UNDO_REPOSITORY_SUFFIX } from '@/features/mcp/mcpTexts';
import type { McpRow, McpRowGroup } from '@/features/mcp/mcpTexts';
import { UNDO_MS } from '@/features/mcp/useUndoableRemoval';
import './McpUndoRow.css';

interface McpUndoRowProps {
  row: McpRow;
  group: McpRowGroup;
  onUndo: () => void;
}

/** Steht an der Stelle der entfernten Zeile, bis das Entfernen geschrieben wird. */
export function McpUndoRow({ row, group, onUndo }: McpUndoRowProps): ReactElement {
  const barStyle = { '--mcp-undo-duration': `${String(UNDO_MS)}ms` } as CSSProperties;

  return (
    <li className="mcp-undo" role="status">
      <span className="mcp-undo__text">
        <strong className="mcp-undo__name">{row.name}</strong> entfernt aus {group.title}
        {group.kind === 'repository' && UNDO_REPOSITORY_SUFFIX}
      </span>
      <span className="mcp-undo__time" style={barStyle} aria-hidden="true">
        <span className="mcp-undo__time-left" />
      </span>
      <button
        type="button"
        className="mcp-dialog__button mcp-dialog__button--small"
        onClick={onUndo}
      >
        {UNDO_LABEL}
      </button>
    </li>
  );
}
