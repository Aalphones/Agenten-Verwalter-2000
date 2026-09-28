import type { ReactElement } from 'react';
import type { ToolEntry } from '@/features/chat/buildBlocks';
import { groupDot, groupSummary, groupTitle } from '@/features/chat/toolSummary';
import './ToolGroup.css';

interface ToolGroupProps {
  tools: readonly ToolEntry[];
  isExpanded: boolean;
  onToggle: () => void;
}

export function ToolGroup({ tools, isExpanded, onToggle }: ToolGroupProps): ReactElement {
  return (
    <div className="tool-group">
      <button
        type="button"
        className="tool-group__toggle"
        aria-expanded={isExpanded}
        onClick={onToggle}
      >
        <span className={`tool-group__dot tool-group__dot--${groupDot(tools)}`} />
        <span className="tool-group__title">{groupTitle(tools)}</span>
        <span className="tool-group__summary">{groupSummary(tools)}</span>
        <svg
          className="tool-group__chevron"
          width="11"
          height="11"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d={isExpanded ? 'M3.5 5.5 7 9l3.5-3.5' : 'M5.5 3.5 9 7l-3.5 3.5'} />
        </svg>
      </button>
      {isExpanded && (
        <div className="tool-group__lines">
          {tools.map((tool: ToolEntry) => (
            <div
              key={tool.toolUseId}
              className={`tool-group__line tool-group__line--${tool.state}`}
            >
              <span className="tool-group__branch">⎿</span>
              <span className="tool-group__tool">{tool.tool}</span>
              <span className="tool-group__target">{tool.target}</span>
              {tool.state === 'interrupted' && (
                <span className="tool-group__interrupted">unterbrochen</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
