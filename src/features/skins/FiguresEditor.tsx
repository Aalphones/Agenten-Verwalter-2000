import { useState } from 'react';
import type { ReactElement } from 'react';
import { CustomSlotFields } from '@/features/skins/CustomSlotFields';
import { FigureSlotRow } from '@/features/skins/FigureSlotRow';
import {
  builtinLook,
  figuresOf,
  newCustomSlot,
  withMovedCustomSlot,
  withNewCustomSlot,
  withRestoredCustomSlot,
  withoutCustomSlot,
} from '@/features/skins/figuresData';
import { customSlotCountError } from '@/features/skins/limits';
import { saveFigures } from '@/features/skins/saveFigures';
import { SkinUndoBar } from '@/features/skins/SkinUndoBar';
import { BUILTIN_SLOT_IDS, SLOT_LABELS } from '@/features/skins/slotCatalog';
import type { BuiltinSlotId } from '@/features/skins/slotCatalog';
import { ToolName } from '@/features/skins/ToolName';
import type { SkinPackActions } from '@/features/skins/useSkinPack';
import { useToolUsage } from '@/features/skins/useToolUsage';
import type { CustomSlot } from '@/lib/bindings/CustomSlot';
import type { FiguresData } from '@/lib/bindings/FiguresData';
import type { SkinPack } from '@/lib/bindings/SkinPack';
import { useSkinsStore } from '@/stores/skins';
import './FiguresEditor.css';

interface FiguresEditorProps {
  pack: SkinPack;
  actions: SkinPackActions;
}

interface RemovedSlot {
  slot: CustomSlot;
  index: number;
}

/** Editor eines Figurenpakets: eigene Fächer (zuerst geprüft), dann die vorgegebenen. */
export function FiguresEditor({ pack, actions }: FiguresEditorProps): ReactElement | null {
  const openSlot: string | null = useSkinsStore((state) => state.openSlot);
  const setOpenSlot = useSkinsStore((state) => state.setOpenSlot);
  const { usage, isFailed } = useToolUsage();
  const [removed, setRemoved] = useState<RemovedSlot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const figures: FiguresData | null = figuresOf(pack.data);
  if (figures === null) {
    return null;
  }
  const custom: readonly CustomSlot[] = figures.custom;

  function report(problem: string | null): void {
    setError(problem);
  }

  function addSlot(): void {
    const countProblem: string | null = customSlotCountError(custom.length);
    if (countProblem !== null) {
      setError(countProblem);
      return;
    }
    const slot: CustomSlot = newCustomSlot();
    saveFigures(actions, (current: FiguresData) => withNewCustomSlot(current, slot))
      .then((problem: string | null) => {
        report(problem);
        if (problem === null) {
          setOpenSlot(slot.id);
        }
      })
      .catch(() => undefined);
  }

  function moveSlot(id: string, offset: -1 | 1): void {
    saveFigures(actions, (current: FiguresData) => withMovedCustomSlot(current, id, offset))
      .then(report)
      .catch(() => undefined);
  }

  function removeSlot(slot: CustomSlot): void {
    const index: number = custom.findIndex((candidate: CustomSlot) => candidate.id === slot.id);
    saveFigures(actions, (current: FiguresData) => withoutCustomSlot(current, slot.id))
      .then((problem: string | null) => {
        report(problem);
        if (problem === null) {
          setRemoved({ slot, index });
          if (openSlot === slot.id) {
            setOpenSlot(null);
          }
        }
      })
      .catch(() => undefined);
  }

  function restoreSlot(): void {
    if (removed === null) {
      return;
    }
    const { slot, index } = removed;
    setRemoved(null);
    saveFigures(actions, (current: FiguresData) => withRestoredCustomSlot(current, slot, index))
      .then(report)
      .catch(() => undefined);
  }

  function toggle(slot: string): void {
    setOpenSlot(openSlot === slot ? null : slot);
  }

  function renderAddButton(): ReactElement {
    return (
      <span className="figures-editor__add">
        <button type="button" className="settings-view__button" onClick={addSlot}>
          Eigenes Fach anlegen
        </button>
        <ToolName action="slotSet" />
      </span>
    );
  }

  function renderCustomGroup(): ReactElement {
    if (custom.length === 0) {
      return (
        <>
          <div className="figures-editor__group">
            Eigene Fächer
            {renderAddButton()}
          </div>
          <p className="figures-editor__hint figures-editor__hint--indent">
            Noch keine. Ein eigenes Fach reagiert auf Werkzeuge nach Muster, z. B.{' '}
            <code>mcp__github__*</code> oder Befehle wie <code>pnpm check*</code>.
          </p>
        </>
      );
    }
    return (
      <>
        <div className="figures-editor__group">
          Eigene Fächer – zuerst geprüft
          {renderAddButton()}
        </div>
        {custom.map((slot: CustomSlot, index: number) => (
          <FigureSlotRow
            key={slot.id}
            pack={pack}
            slotKey={slot.id}
            name={slot.name}
            subtitle={slot.tools}
            look={slot.look}
            isOpen={openSlot === slot.id}
            onToggle={(): void => {
              toggle(slot.id);
            }}
            actions={actions}
            customFields={
              <CustomSlotFields
                slot={slot}
                canMoveUp={index > 0}
                canMoveDown={index < custom.length - 1}
                usage={usage}
                isUsageFailed={isFailed}
                actions={actions}
                onMove={(offset: -1 | 1): void => {
                  moveSlot(slot.id, offset);
                }}
                onRemove={(): void => {
                  removeSlot(slot);
                }}
              />
            }
          />
        ))}
      </>
    );
  }

  return (
    <div className="figures-editor">
      <div className="figures-editor__slots">
        {renderCustomGroup()}
        <div className="figures-editor__group">Vorgegebene Fächer</div>
        {BUILTIN_SLOT_IDS.map((slotId: BuiltinSlotId) => (
          <FigureSlotRow
            key={slotId}
            pack={pack}
            slotKey={slotId}
            name={SLOT_LABELS[slotId]}
            subtitle={slotId}
            look={builtinLook(figures, slotId)}
            isOpen={openSlot === slotId}
            onToggle={(): void => {
              toggle(slotId);
            }}
            actions={actions}
          />
        ))}
      </div>
      {error !== null && (
        <p className="figures-editor__error" role="alert">
          {error}
        </p>
      )}
      {removed !== null && (
        <SkinUndoBar
          message={`Fach „${removed.slot.name}“ entfernt.`}
          onUndo={restoreSlot}
          onExpire={(): void => {
            setRemoved(null);
          }}
        />
      )}
      <p className="figures-editor__hint">
        Das erste passende Fach gewinnt: eigene Fächer von oben nach unten, dann die vorgegebenen.
        Muster: <code>*</code> beliebig viele Zeichen, <code>?</code> ein Zeichen, Groß/klein egal,
        mehrere mit Komma.
      </p>
    </div>
  );
}
