import type { ReactElement } from 'react';
import type { TextEntry, ToolEntry } from '@/features/chat/buildBlocks';
import { TextBlock } from '@/features/chat/TextBlock';
import { ToolDetail } from '@/features/chat/ToolDetail';
import {
  builtinSlot,
  failedCount,
  fileName,
  groupDot,
  groupParts,
  toolName,
  toolVerb,
  type GroupPart,
  type ToolDot,
} from '@/features/chat/toolSummary';
import { formatCommandDuration } from '@/features/runs/runTexts';
import { slotFor, type CustomSlotMatch } from '@/features/skins/matchSlot';
import { SlotThumb } from '@/features/skins/SlotThumb';
import type { SkinPack } from '@/lib/bindings/SkinPack';
import './ToolGroup.css';

const TOOL_TOGGLE_HINT = 'Eingabe und Ausgabe dieses Aufrufs ein-/ausblenden';

interface ToolGroupProps {
  sessionId: string;
  tools: readonly ToolEntry[];
  /** Die kurze Zeile des Agenten direkt vor dem Block; `null` = keine. */
  purpose: TextEntry | null;
  figures: SkinPack | null;
  customSlots: readonly CustomSlotMatch[];
  /** Dauer beendeter Befehle (ms) nach `toolUseId`. */
  durationByToolUseId: ReadonlyMap<string, number>;
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

function StateDot({ dot }: { dot: ToolDot }): ReactElement {
  return <span className={`tool-group__dot tool-group__dot--${dot}`} />;
}

interface ToolTargetProps {
  tool: ToolEntry;
}

/** Das Ziel der Zeile: Dateiname, Beschreibung, Werkzeugname oder Ziel — einzeilig, das ungekürzte steht im `title`. */
function ToolTarget({ tool }: ToolTargetProps): ReactElement {
  const slot = builtinSlot(tool.tool);
  const title: string | undefined = tool.target === '' ? undefined : tool.target;
  if (slot === 'read' || slot === 'write') {
    return (
      <span className="tool-group__name" title={title}>
        {fileName(tool.target)}
      </span>
    );
  }
  if (slot === 'shell' && tool.description !== null) {
    return (
      <span className="tool-group__name tool-group__name--prose" title={title}>
        {tool.description}
      </span>
    );
  }
  if (slot === 'other') {
    return <span className="tool-group__name tool-group__name--prose">{toolName(tool.tool)}</span>;
  }
  return (
    <span className="tool-group__name" title={title}>
      {tool.target}
    </span>
  );
}

interface ToolLineProps {
  tool: ToolEntry;
  figures: SkinPack | null;
  customSlots: readonly CustomSlotMatch[];
  durationMs: number | undefined;
  isOpen: boolean;
  onToggle: () => void;
  isSingle: boolean;
  hasDot: boolean;
}

function ToolLine({
  tool,
  figures,
  customSlots,
  durationMs,
  isOpen,
  onToggle,
  isSingle,
  hasDot,
}: ToolLineProps): ReactElement {
  const classes: string[] = ['tool-group__line', `tool-group__line--${tool.state}`];
  if (isSingle) {
    classes.push('tool-group__line--single');
  }
  return (
    <button
      type="button"
      className={classes.join(' ')}
      aria-expanded={isOpen}
      title={TOOL_TOGGLE_HINT}
      onClick={onToggle}
    >
      {isSingle ? (
        hasDot && <StateDot dot={groupDot([tool])} />
      ) : (
        <span className="tool-group__branch">⎿</span>
      )}
      <SlotThumb pack={figures} slot={slotFor(tool.tool, tool.target, customSlots)} />
      <span className="tool-group__tool">{toolVerb(tool.tool)}</span>
      <ToolTarget tool={tool} />
      {tool.state === 'running' && <span className="tool-group__state">läuft</span>}
      {tool.state === 'interrupted' && <span className="tool-group__state">unterbrochen</span>}
      {tool.state === 'failed' && (
        <span className="tool-group__state tool-group__state--failed">fehlgeschlagen</span>
      )}
      {durationMs !== undefined && (
        <span className="tool-group__duration">{formatCommandDuration(durationMs)}</span>
      )}
      <Chevron isOpen={isOpen} className="tool-group__chevron" />
    </button>
  );
}

export function ToolGroup({
  sessionId,
  tools,
  purpose,
  figures,
  customSlots,
  durationByToolUseId,
  isExpanded,
  onToggle,
  isToolExpanded,
  onToggleTool,
}: ToolGroupProps): ReactElement {
  const dot: ToolDot = groupDot(tools);
  const hasPurpose: boolean = purpose !== null;
  const [only] = tools;
  const parts: GroupPart[] = groupParts(tools);
  const failed: number = failedCount(tools);

  function renderLine(tool: ToolEntry, isSingle: boolean): ReactElement {
    const isOpen: boolean = isToolExpanded(tool.toolUseId);
    return (
      <div key={tool.toolUseId} className="tool-group__item">
        <ToolLine
          tool={tool}
          figures={figures}
          customSlots={customSlots}
          durationMs={durationByToolUseId.get(tool.toolUseId)}
          isOpen={isOpen}
          onToggle={(): void => {
            onToggleTool(tool.toolUseId);
          }}
          isSingle={isSingle}
          hasDot={!hasPurpose}
        />
        {isOpen && <ToolDetail sessionId={sessionId} tool={tool} />}
      </div>
    );
  }

  return (
    <div className={hasPurpose ? 'tool-group tool-group--purpose' : 'tool-group'}>
      {purpose !== null && (
        <div className="tool-group__head">
          <StateDot dot={dot} />
          <div className="tool-group__purpose">
            <TextBlock text={purpose.text} unsourced={[]} />
          </div>
        </div>
      )}
      <div className="tool-group__body">
        {tools.length === 1 && only !== undefined ? (
          renderLine(only, true)
        ) : (
          <>
            <button
              type="button"
              className="tool-group__toggle"
              aria-expanded={isExpanded}
              onClick={onToggle}
            >
              {!hasPurpose && <StateDot dot={dot} />}
              {parts.map((part: GroupPart, index: number) => (
                <span key={part.slot} className="tool-group__part">
                  <SlotThumb pack={figures} slot={part.slot} />
                  {part.label}
                  {(index < parts.length - 1 || failed > 0) && (
                    <span className="tool-group__sep" aria-hidden="true">
                      ·
                    </span>
                  )}
                </span>
              ))}
              {failed > 0 && (
                <span className="tool-group__fail">{String(failed)} fehlgeschlagen</span>
              )}
              <Chevron isOpen={isExpanded} className="tool-group__chevron" />
            </button>
            {isExpanded && (
              <div className="tool-group__lines">
                {tools.map((tool: ToolEntry) => renderLine(tool, false))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
