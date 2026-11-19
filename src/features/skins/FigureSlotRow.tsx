import { useId, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { CommitField } from '@/features/skins/CommitField';
import { FigureStage } from '@/features/skins/FigureStage';
import { fillText } from '@/features/skins/fillText';
import {
  isBuiltinSlotId,
  slotLook,
  withFittingMotion,
  withLook,
} from '@/features/skins/figuresData';
import { ImageField } from '@/features/skins/ImageField';
import { parseTexts, textsError } from '@/features/skins/limits';
import { FITTING_MOTION, MOTION_LABELS } from '@/features/skins/motionCatalog';
import { saveFigures } from '@/features/skins/saveFigures';
import { skinImageUrl } from '@/features/skins/skinImage';
import { SkinThumb } from '@/features/skins/SkinThumb';
import { PLAIN_TEXTS } from '@/features/skins/slotCatalog';
import { ToolName } from '@/features/skins/ToolName';
import type { SkinPackActions } from '@/features/skins/useSkinPack';
import type { ImageSource } from '@/lib/bindings/ImageSource';
import type { Motion } from '@/lib/bindings/Motion';
import type { SkinPack } from '@/lib/bindings/SkinPack';
import type { SlotLook } from '@/lib/bindings/SlotLook';
import './FigureSlotRow.css';

/** Werte, mit denen die Vorschau die Platzhalter der Texte füllt. */
const PREVIEW_VALUES = {
  ziel: 'ChatTimeline.tsx',
  befehl: 'pnpm check',
  zeit: '14:30',
  commit: 'a1b2c3d',
  fortschritt: '12/40',
  rest: '~1:25',
} as const;
const MOTION_KEYS = Object.keys(MOTION_LABELS) as Motion[];

interface FigureSlotRowProps {
  pack: SkinPack;
  /** Name des mitgelieferten Fachs oder ID des eigenen (`c-…`). */
  slotKey: string;
  name: string;
  /** Werkzeuge bzw. Muster, die das Fach fängt; steht klein im Kopf. */
  subtitle: string;
  look: SlotLook;
  isOpen: boolean;
  onToggle: () => void;
  actions: SkinPackActions;
  /** Zusatzfelder eines eigenen Fachs (Name, Muster, Treffer, Verschieben). */
  customFields?: ReactNode;
}

function summary(look: SlotLook): string {
  const textCount: number = look.texts.length;
  const texts: string = textCount === 1 ? '1 Text' : `${String(textCount)} Texte`;
  return `${look.image === null ? 'ohne Bild' : 'Bild'} · ${MOTION_LABELS[look.motion]} · ${texts}`;
}

/** Eine aufklappbare Fachzeile des Figuren-Editors: Kopf mit Zusammenfassung, Körper mit Bild, Bewegung, Texten und Vorschau. */
export function FigureSlotRow({
  pack,
  slotKey,
  name,
  subtitle,
  look,
  isOpen,
  onToggle,
  actions,
  customFields,
}: FigureSlotRowProps): ReactElement {
  const bodyId: string = useId();
  const motionId: string = useId();
  const [motionError, setMotionError] = useState<string | null>(null);
  const hasSecondImage: boolean = slotKey === 'station';
  const fittingMotion: Motion | null = isBuiltinSlotId(slotKey) ? FITTING_MOTION[slotKey] : null;

  async function setImage(second: boolean, source: ImageSource): Promise<string | null> {
    const problem: string | null = await actions.setImage(
      { kind: 'slot', slot: slotKey, second },
      source,
    );
    if (problem !== null || second) {
      return problem;
    }
    // Ein Bild ohne Bewegung bekäme sonst keine: die zum Fach passende wird gesetzt.
    return saveFigures(actions, (figures) => withFittingMotion(figures, slotKey));
  }

  function removeImage(second: boolean): Promise<string | null> {
    return actions.removeImage({ kind: 'slot', slot: slotKey, second });
  }

  function changeMotion(motion: Motion): void {
    setMotionError(null);
    saveFigures(actions, (figures) => {
      const current: SlotLook | null = slotLook(figures, slotKey);
      if (current === null || current.motion === motion) {
        return figures;
      }
      return withLook(figures, slotKey, { ...current, motion });
    })
      .then(setMotionError)
      .catch(() => undefined);
  }

  function commitTexts(raw: string): Promise<string | null> {
    const texts: string[] = parseTexts(raw);
    return saveFigures(actions, (figures) => {
      const current: SlotLook | null = slotLook(figures, slotKey);
      return current === null ? figures : withLook(figures, slotKey, { ...current, texts });
    });
  }

  function renderPreview(): ReactElement {
    const template: string =
      look.texts[0] ?? (isBuiltinSlotId(slotKey) ? PLAIN_TEXTS[slotKey] : PLAIN_TEXTS.other);
    return (
      <div className="figure-slot__preview">
        <span className="figure-slot__preview-label">Vorschau</span>
        <FigureStage pack={pack} look={look} size="line" />
        <span className="figure-slot__preview-text">{fillText(template, PREVIEW_VALUES)}</span>
      </div>
    );
  }

  function renderBody(): ReactElement {
    return (
      <div id={bodyId} className="figure-slot__body">
        {customFields}
        <ImageField
          label="Bild"
          pack={pack}
          fileName={look.image}
          kind="figure"
          onSource={(source: ImageSource): Promise<string | null> => setImage(false, source)}
          onRemove={(): Promise<string | null> => removeImage(false)}
        />
        {hasSecondImage && (
          <ImageField
            label="Zweites Bild (für „Entwicklung“)"
            pack={pack}
            fileName={look.image2}
            kind="figure"
            onSource={(source: ImageSource): Promise<string | null> => setImage(true, source)}
            onRemove={(): Promise<string | null> => removeImage(true)}
          />
        )}
        <div className="figure-slot__field">
          <label className="figure-slot__label" htmlFor={motionId}>
            Bewegung
            <ToolName action="slotSet" />
          </label>
          <select
            id={motionId}
            className="figure-slot__select"
            value={look.motion}
            onChange={(event) => {
              changeMotion(event.target.value as Motion);
            }}
          >
            {MOTION_KEYS.map((motion: Motion) => (
              <option key={motion} value={motion}>
                {MOTION_LABELS[motion]}
                {motion === fittingMotion ? ' (passt)' : ''}
              </option>
            ))}
          </select>
          {motionError !== null && (
            <p className="figure-slot__error" role="alert">
              {motionError}
            </p>
          )}
        </div>
        <CommitField
          label={
            <>
              Texte, einer pro Zeile – <code>{'{ziel}'}</code>, <code>{'{zeit}'}</code>,{' '}
              <code>{'{commit}'}</code> werden ersetzt
            </>
          }
          multiline
          value={look.texts.join('\n')}
          validate={textsError}
          onCommit={commitTexts}
        />
        {renderPreview()}
      </div>
    );
  }

  return (
    <div className={`figure-slot${isOpen ? ' figure-slot--open' : ''}`}>
      <button
        type="button"
        className="figure-slot__head"
        aria-expanded={isOpen}
        aria-controls={isOpen ? bodyId : undefined}
        onClick={onToggle}
      >
        <svg className="figure-slot__chevron" viewBox="0 0 10 10" aria-hidden="true">
          <path d="M3 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
        <SkinThumb
          src={look.image === null ? null : skinImageUrl(pack, look.image)}
          emptyText="—"
        />
        <span className="figure-slot__titles">
          <span className="figure-slot__name">{name}</span>
          <span className="figure-slot__tools">{subtitle}</span>
        </span>
        <span className="figure-slot__summary">{summary(look)}</span>
      </button>
      {isOpen && renderBody()}
    </div>
  );
}
