import type { ReactElement } from 'react';
import type { McpGroupWhere } from '@/features/mcp/mcpTexts';

const FIXED_PLACE_TEXT = 'nicht änderbar';

/** Reichweite und Datei einer Gruppe, im Gruppenkopf und in den Details. */
export function McpGroupPlace({ where }: { where: McpGroupWhere | null }): ReactElement {
  if (where === null) {
    return <>{FIXED_PLACE_TEXT}</>;
  }
  return (
    <>
      {where.reach} · <span className="mcp-dialog__file">{where.file}</span>
      {where.suffix}
    </>
  );
}
