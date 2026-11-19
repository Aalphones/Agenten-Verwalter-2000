import type { ToolEntry } from '@/features/chat/buildBlocks';
import { BUILTIN_TOOL_SLOTS, type BuiltinSlotId } from '@/features/skins/slotCatalog';

export type ToolDot = 'running' | 'done' | 'failed';

/** Ein Teil der Was-Zeile: die Art (für die Figur) und der Zähltext. */
export interface GroupPart {
  slot: BuiltinSlotId;
  label: string;
}

const MCP_NAME = /^mcp__(.+?)__(.+)$/;

const COUNT_LABELS: Readonly<Record<BuiltinSlotId, readonly [string, string]>> = {
  search: ['Suche', 'Suchen'],
  read: ['Datei gelesen', 'Dateien gelesen'],
  write: ['Datei bearbeitet', 'Dateien bearbeitet'],
  shell: ['Befehl', 'Befehle'],
  longrun: ['Befehl', 'Befehle'],
  web: ['Web-Abruf', 'Web-Abrufe'],
  agent: ['Unteragent', 'Unteragenten'],
  other: ['weiterer Aufruf', 'weitere Aufrufe'],
  wait: ['Aufruf', 'Aufrufe'],
  think: ['Aufruf', 'Aufrufe'],
  commit: ['Aufruf', 'Aufrufe'],
  station: ['Aufruf', 'Aufrufe'],
};

const TOOL_VERBS: Readonly<Record<string, string>> = {
  Grep: 'Gesucht',
  Glob: 'Gesucht',
  Read: 'Gelesen',
  Edit: 'Bearbeitet',
  NotebookEdit: 'Bearbeitet',
  Write: 'Geschrieben',
  Bash: 'Befehl',
  PowerShell: 'Befehl',
  WebSearch: 'Websuche',
  WebFetch: 'Abgerufen',
  Agent: 'Unteragent',
  Task: 'Unteragent',
};

/** Das mitgelieferte Fach eines Werkzeugs; ohne Eintrag „Sonstiges“. */
export function builtinSlot(tool: string): BuiltinSlotId {
  return BUILTIN_TOOL_SLOTS[tool] ?? 'other';
}

function isFileSlot(slot: BuiltinSlotId): boolean {
  return slot === 'read' || slot === 'write';
}

/** Die Teile der Was-Zeile in der Reihenfolge des ersten Auftretens; Dateien zählen je Pfad einmal. */
export function groupParts(tools: readonly ToolEntry[]): GroupPart[] {
  const order: BuiltinSlotId[] = [];
  const calls = new Map<BuiltinSlotId, number>();
  const targets = new Map<BuiltinSlotId, Set<string>>();
  for (const tool of tools) {
    const slot: BuiltinSlotId = builtinSlot(tool.tool);
    if (!calls.has(slot)) {
      order.push(slot);
      calls.set(slot, 0);
      targets.set(slot, new Set<string>());
    }
    calls.set(slot, (calls.get(slot) ?? 0) + 1);
    targets.get(slot)?.add(tool.target);
  }
  const onlyOther: boolean = order.length === 1 && order[0] === 'other';
  return order.map((slot: BuiltinSlotId): GroupPart => {
    const count: number = isFileSlot(slot)
      ? (targets.get(slot)?.size ?? 0)
      : (calls.get(slot) ?? 0);
    if (onlyOther) {
      return { slot, label: `${String(count)} Aufrufe` };
    }
    const [one, many] = COUNT_LABELS[slot];
    return { slot, label: `${String(count)} ${count === 1 ? one : many}` };
  });
}

export function failedCount(tools: readonly ToolEntry[]): number {
  return tools.filter((tool: ToolEntry) => tool.state === 'failed').length;
}

/** Die Tätigkeit an der Aufruf-Zeile. */
export function toolVerb(tool: string): string {
  return TOOL_VERBS[tool] ?? 'Werkzeug';
}

/** `mcp__verwalter__implementation_create` → „verwalter · implementation_create“. */
export function toolName(tool: string): string {
  const match: RegExpExecArray | null = MCP_NAME.exec(tool);
  return match === null ? tool : `${match[1] ?? ''} · ${match[2] ?? ''}`;
}

/** Nur der Dateiname: alles hinter dem letzten Pfadtrenner. */
export function fileName(target: string): string {
  const index: number = Math.max(target.lastIndexOf('\\'), target.lastIndexOf('/'));
  return index < 0 ? target : target.slice(index + 1);
}

/** Ein unterbrochener Aufruf ohne Fehler zählt als fertig — seine Zeile sagt „unterbrochen“. */
export function groupDot(tools: readonly ToolEntry[]): ToolDot {
  if (tools.some((tool: ToolEntry) => tool.state === 'failed')) {
    return 'failed';
  }
  if (tools.some((tool: ToolEntry) => tool.state === 'running')) {
    return 'running';
  }
  return 'done';
}
