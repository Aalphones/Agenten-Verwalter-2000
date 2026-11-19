import type { ToolEntry } from '@/features/chat/buildBlocks';

export type ToolDot = 'running' | 'done' | 'failed';

const FILE_TOOLS: ReadonlySet<string> = new Set<string>(['Read', 'Write', 'Edit']);
const SEARCH_TOOLS: ReadonlySet<string> = new Set<string>(['Grep', 'Glob']);
const COMMAND_TOOLS: ReadonlySet<string> = new Set<string>(['Bash', 'PowerShell']);
const MIXED_TITLE = 'Werkzeuge';

/** Was die Zeile eines Aufrufs zeigt: die Befehlsbeschreibung, sonst das Ziel (bei Befehlen der Befehl). */
export function toolLabel(tool: ToolEntry): string {
  return tool.description ?? tool.target;
}

function sharedTool(tools: readonly ToolEntry[]): string | null {
  const first: string | undefined = tools[0]?.tool;
  if (first === undefined) {
    return null;
  }
  return tools.every((tool: ToolEntry) => tool.tool === first) ? first : null;
}

export function groupTitle(tools: readonly ToolEntry[]): string {
  return sharedTool(tools) ?? MIXED_TITLE;
}

export function groupSummary(tools: readonly ToolEntry[]): string {
  const [only] = tools;
  if (tools.length === 1 && only !== undefined) {
    return toolLabel(only);
  }
  const count: string = String(tools.length);
  const tool: string | null = sharedTool(tools);
  if (tool === null) {
    return `${count} Aufrufe`;
  }
  if (FILE_TOOLS.has(tool)) {
    return `${count} Dateien`;
  }
  if (SEARCH_TOOLS.has(tool)) {
    return `${count} Suchen`;
  }
  if (COMMAND_TOOLS.has(tool)) {
    return `${count} Befehle`;
  }
  return `${count} Aufrufe`;
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
