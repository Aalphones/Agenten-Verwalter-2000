import type { BackgroundItem } from '@/lib/bindings/BackgroundItem';
import type { ChatEntry } from '@/lib/bindings/ChatEntry';

export type ToolEntry = Extract<ChatEntry, { kind: 'tool' }>;
export type TextEntry = Extract<ChatEntry, { kind: 'text' }>;

export type ChatBlock =
  | { kind: 'entry'; key: string; entry: Exclude<ChatEntry, ToolEntry> }
  | { kind: 'tools'; key: string; tools: readonly ToolEntry[]; purpose: TextEntry | null }
  | { kind: 'background'; key: string; tool: ToolEntry; item: BackgroundItem };

/** Längste Zeile des Agenten, die noch als Kopf eines Werkzeug-Blocks gilt; Längeres bleibt Text. */
const MAX_PURPOSE_CHARS = 80;

/** Ob der Block ein Text ist, der als Zweckzeile taugt: kurz, ein Absatz, ohne Markierung „ohne Fundstelle“ und nicht der Text mit der „Weiter“-Leiste. */
function isPurposeBlock(
  block: ChatBlock | undefined,
  keepTextSeq: number | null,
): block is ChatBlock & {
  kind: 'entry';
  entry: TextEntry;
} {
  if (block?.kind !== 'entry' || block.entry.kind !== 'text') {
    return false;
  }
  const text: string = block.entry.text.trim();
  return (
    text.length > 0 &&
    text.length <= MAX_PURPOSE_CHARS &&
    !text.includes('\n') &&
    block.entry.unsourced.length === 0 &&
    block.entry.seq !== keepTextSeq
  );
}

/** Fasst aufeinanderfolgende Werkzeug-Einträge zu einer Gruppe zusammen; alles andere bleibt ein Block je Eintrag.
 *  Ein Werkzeugaufruf, zu dem es einen Subagenten oder Hintergrundprozess gibt (`backgroundByToolUseId`), löst sich
 *  aus der Gruppe: Sie endet davor, der Hintergrund-Block folgt, danach beginnt eine neue.
 *  Ein kurzer Text direkt vor einer Gruppe wird ihr Kopf (`purpose`), außer er ist der Text mit der „Weiter“-Leiste
 *  (`keepTextSeq`). Der Schlüssel ist die `seq` des Kopfes, sonst die des ersten Eintrags — er bleibt stabil, solange
 *  hinten angehängt wird. */
export function buildBlocks(
  entries: readonly ChatEntry[],
  backgroundByToolUseId: ReadonlyMap<string, BackgroundItem>,
  keepTextSeq: number | null,
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
        const last: ChatBlock | undefined = blocks[blocks.length - 1];
        if (isPurposeBlock(last, keepTextSeq)) {
          blocks.pop();
          blocks.push({
            kind: 'tools',
            key: String(last.entry.seq),
            tools: group,
            purpose: last.entry,
          });
        } else {
          blocks.push({ kind: 'tools', key: String(entry.seq), tools: group, purpose: null });
        }
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
