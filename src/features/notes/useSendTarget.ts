import { useProjectTerminals } from '@/features/terminal/useProjectTerminals';
import type { TerminalInfo } from '@/lib/bindings/TerminalInfo';
import { useTerminalStore } from '@/stores/terminal';

/** Das Terminal, in das „Ins Terminal“ schreibt: das gewählte des Vorhabens, wenn es läuft, sonst das zuletzt
 *  erstellte laufende; `null`, wenn keins läuft. */
export function useSendTarget(projectId: string): TerminalInfo | null {
  const { terminals } = useProjectTerminals(projectId);
  const selectedId: string | undefined = useTerminalStore((state) => state.selected[projectId]);
  const running: TerminalInfo[] = terminals.filter((terminal: TerminalInfo) => terminal.running);
  const selected: TerminalInfo | undefined = running.find(
    (terminal: TerminalInfo) => terminal.id === selectedId,
  );
  return selected ?? running[running.length - 1] ?? null;
}
