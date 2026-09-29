import type { BackgroundItem } from '@/lib/bindings/BackgroundItem';
import type { ChatEntry } from '@/lib/bindings/ChatEntry';

export type ToolEntry = Extract<ChatEntry, { kind: 'tool' }>;

export type ChatBlock =
  | { kind: 'entry'; key: string; entry: Exclude<ChatEntry, ToolEntry> }
  | { kind: 'tools'; key: string; tools: readonly ToolEntry[] }
  | { kind: 'background'; key: string; tool: ToolEntry; item: BackgroundItem };

/** Fasst aufeinanderfolgende Werkzeug-Einträge zu einer Gruppe zusammen; alles andere bleibt ein Block je Eintrag.
 *  Ein Werkzeugaufruf, zu dem es einen Subagenten oder Hintergrundprozess gibt (`backgroundByToolUseId`), löst sich
 *  aus der Gruppe: Sie endet davor, der Hintergrund-Block folgt, danach beginnt eine neue.
 *  Der Schlüssel ist die `seq` des ersten Eintrags — er bleibt stabil, solange hinten angehängt wird. */
export function buildBlocks(
  entries: readonly ChatEntry[],
  backgroundByToolUseId: ReadonlyMap<string, BackgroundItem>,
): ChatBlock[] {
  const blocks: ChatBlock[] = [];
  let group: ToolEntry[] | null = null;
  for (const entry of entries) {
    if (entry.kind === 'tool') {
      const item: BackgroundItem | undefined = backgroundByToolUseId.get(entry.toolUseId);
      if (item !== undefined) {
        group = null;
        blocks.push({ kind: 'background', key: String(entry.seq), tool: entry, item });
      } else if (group === null) {
        group = [entry];
        blocks.push({ kind: 'tools', key: String(entry.seq), tools: group });
      } else {
        group.push(entry);
      }
      continue;
    }
    group = null;
    blocks.push({ kind: 'entry', key: String(entry.seq), entry });
  }
  return blocks;
}
