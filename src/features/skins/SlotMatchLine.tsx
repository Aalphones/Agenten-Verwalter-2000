import type { ReactElement } from 'react';
import { matchesAny } from '@/features/skins/matchSlot';
import type { ToolUsage } from '@/lib/bindings/ToolUsage';
import './SlotMatchLine.css';

/** So viele Treffer zeigt die Zeile; mehr würden die Fachzeile sprengen. */
const MAX_SHOWN_HITS = 5;

interface SlotMatchLineProps {
  tools: string;
  input: string;
  /** Aufrufe der letzten Sessions; `null`, solange sie laden oder nicht lesbar waren. */
  usage: readonly ToolUsage[] | null;
  isFailed: boolean;
}

function hits(tools: string, input: string, usage: readonly ToolUsage[]): ToolUsage[] {
  const hasInput: boolean = input.trim() !== '';
  return usage
    .filter(
      (call: ToolUsage) =>
        matchesAny(tools, call.tool) && (!hasInput || matchesAny(input, call.inputPrefix)),
    )
    .slice(0, MAX_SHOWN_HITS);
}

/** „Trifft in deinen letzten Sessions: …“ — die Aufrufe, die dieses Fach heute fangen würde. */
export function SlotMatchLine({ tools, input, usage, isFailed }: SlotMatchLineProps): ReactElement {
  if (isFailed) {
    return <p className="slot-match">Die letzten Sessions ließen sich nicht lesen.</p>;
  }
  if (usage === null) {
    return <p className="slot-match">Prüfe die letzten Sessions …</p>;
  }
  const found: ToolUsage[] = hits(tools, input, usage);
  if (found.length === 0) {
    return <p className="slot-match slot-match--none">Trifft in deinen letzten Sessions nichts.</p>;
  }
  return (
    <p className="slot-match">
      Trifft in deinen letzten Sessions:{' '}
      {found.map((call: ToolUsage, index: number) => (
        <span key={`${call.tool}\u0000${call.inputPrefix}`}>
          {index > 0 && ' · '}
          <b className="slot-match__tool">{call.tool}</b>{' '}
          <i className="slot-match__input">{call.inputPrefix}</i>
        </span>
      ))}
    </p>
  );
}
