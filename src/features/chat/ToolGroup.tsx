import type { ReactElement } from 'react';
import type { ToolEntry } from '@/features/chat/buildBlocks';
import { ToolDetail } from '@/features/chat/ToolDetail';
import { groupDot, groupSummary, groupTitle } from '@/features/chat/toolSummary';
import './ToolGroup.css';

const TOOL_TOGGLE_HINT = 'Eingabe und Ausgabe dieses Aufrufs ein-/ausblenden';

interface ToolGroupProps {
  sessionId: string;
  tools: readonly ToolEntry[];
  isExpanded: boolean;
  onToggle: () => void;
  isToolExpanded: (toolUseId: string) => boolean;
  onToggleTool: (toolUseId: string) => void;
}

interface ChevronProps {
  isOpen: boolean;
  className: string;
}

function Chevron({ isOpen, className }: ChevronProps): ReactElement {
  return (
    <svg
      className={className}
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
      <path d={isOpen ? 'M3.5 5.5 7 9l3.5-3.5' : 'M5.5 3.5 9 7l-3.5 3.5'} />
    </svg>
  );
}

export function ToolGroup({
  sessionId,
  tools,
  isExpanded,
  onToggle,
  isToolExpanded,
  onToggleTool,
}: ToolGroupProps): ReactElement {
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
        <Chevron isOpen={isExpanded} className="tool-group__chevron" />
      </button>
      {isExpanded && (
        <div className="tool-group__lines">
          {tools.map((tool: ToolEntry) => {
            const isOpen: boolean = isToolExpanded(tool.toolUseId);
            return (
              <div key={tool.toolUseId} className="tool-group__item">
                <button
                  type="button"
                  className={`tool-group__line tool-group__line--${tool.state}`}
                  aria-expanded={isOpen}
                  title={TOOL_TOGGLE_HINT}
                  onClick={(): void => {
                    onToggleTool(tool.toolUseId);
                  }}
                >
                  <span className="tool-group__branch">⎿</span>
                  <span className="tool-group__tool">{tool.tool}</span>
                  <span className="tool-group__target">{tool.target}</span>
                  {tool.state === 'interrupted' && (
                    <span className="tool-group__interrupted">unterbrochen</span>
                  )}
                  <Chevron isOpen={isOpen} className="tool-group__chevron" />
                </button>
                {isOpen && <ToolDetail sessionId={sessionId} tool={tool} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
