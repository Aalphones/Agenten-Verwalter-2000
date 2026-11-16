import { useState } from 'react';
import type { ReactElement } from 'react';
import { CommitField } from '@/features/skins/CommitField';
import { withCustomFields } from '@/features/skins/figuresData';
import { nameError, patternError, toolsError } from '@/features/skins/limits';
import { saveFigures } from '@/features/skins/saveFigures';
import { SlotMatchLine } from '@/features/skins/SlotMatchLine';
import { ToolName } from '@/features/skins/ToolName';
import type { SkinPackActions } from '@/features/skins/useSkinPack';
import type { CustomSlot } from '@/lib/bindings/CustomSlot';
import type { ToolUsage } from '@/lib/bindings/ToolUsage';
import './CustomSlotFields.css';

interface CustomSlotFieldsProps {
  slot: CustomSlot;
  canMoveUp: boolean;
  canMoveDown: boolean;
  usage: readonly ToolUsage[] | null;
  isUsageFailed: boolean;
  actions: SkinPackActions;
  onMove: (offset: -1 | 1) => void;
  onRemove: () => void;
}

/** Name, Muster und Treffer eines eigenen Fachs, dazu Verschieben und Entfernen. */
export function CustomSlotFields({
  slot,
  canMoveUp,
  canMoveDown,
  usage,
  isUsageFailed,
  actions,
  onMove,
  onRemove,
}: CustomSlotFieldsProps): ReactElement {
  // Die Trefferzeile folgt dem Tippen; nach dem Speichern gilt wieder der gespeicherte Wert.
  const [liveTools, setLiveTools] = useState<string | null>(null);
  const [liveInput, setLiveInput] = useState<string | null>(null);

  return (
    <>
      <div className="custom-slot-fields">
        <CommitField
          label="Name"
          value={slot.name}
          validate={(raw: string): string | null => nameError(raw, 'Der Name eines Fachs')}
          onCommit={(raw: string): Promise<string | null> =>
            saveFigures(actions, (figures) => withCustomFields(figures, slot.id, { name: raw }))
          }
        />
        <CommitField
          label="Werkzeuge (Muster)"
          toolAction="slotSet"
          value={slot.tools}
          placeholder="mcp__github__*, Bash"
          validate={toolsError}
          onDraft={setLiveTools}
          onCommit={async (raw: string): Promise<string | null> => {
            const problem: string | null = await saveFigures(actions, (figures) =>
              withCustomFields(figures, slot.id, { tools: raw }),
            );
            if (problem === null) {
              setLiveTools(null);
            }
            return problem;
          }}
        />
        <CommitField
          label="Eingabe (Muster, freiwillig)"
          value={slot.input ?? ''}
          placeholder="git *commit*"
          validate={(raw: string): string | null => patternError(raw, 'Das Eingabe-Muster')}
          onDraft={setLiveInput}
          onCommit={async (raw: string): Promise<string | null> => {
            const problem: string | null = await saveFigures(actions, (figures) =>
              withCustomFields(figures, slot.id, { input: raw.trim() === '' ? null : raw }),
            );
            if (problem === null) {
              setLiveInput(null);
            }
            return problem;
          }}
        />
      </div>
      <SlotMatchLine
        tools={liveTools ?? slot.tools}
        input={liveInput ?? slot.input ?? ''}
        usage={usage}
        isFailed={isUsageFailed}
      />
      <div className="custom-slot-fields__actions">
        <button
          type="button"
          className="settings-view__button"
          disabled={!canMoveUp}
          onClick={(): void => {
            onMove(-1);
          }}
        >
          ↑ nach oben
        </button>
        <button
          type="button"
          className="settings-view__button"
          disabled={!canMoveDown}
          onClick={(): void => {
            onMove(1);
          }}
        >
          ↓ nach unten
        </button>
        <button
          type="button"
          className="settings-view__button custom-slot-fields__remove"
          onClick={onRemove}
        >
          Fach entfernen
        </button>
        <ToolName action="slotRemove" />
      </div>
    </>
  );
}
