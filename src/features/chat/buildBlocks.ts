import type { ChatEntry } from '@/lib/bindings/ChatEntry';

export type ToolEntry = Extract<ChatEntry, { kind: 'tool' }>;

export type ChatBlock =
  | { kind: 'entry'; key: string; entry: Exclude<ChatEntry, ToolEntry> }
  | { kind: 'tools'; key: string; tools: readonly ToolEntry[] };

/** Fasst aufeinanderfolgende Werkzeug-Einträge zu einer Gruppe zusammen; alles andere bleibt ein Block je Eintrag.
 *  Der Schlüssel ist die `seq` des ersten Eintrags — er bleibt stabil, solange hinten angehängt wird. */
export function buildBlocks(entries: readonly ChatEntry[]): ChatBlock[] {
  const blocks: ChatBlock[] = [];
  let group: ToolEntry[] | null = null;
  for (const entry of entries) {
    if (entry.kind === 'tool') {
      if (group === null) {
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
