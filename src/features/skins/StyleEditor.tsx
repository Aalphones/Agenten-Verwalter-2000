import { useState } from 'react';
import type { ReactElement } from 'react';
import { Slider } from '@/components/Slider';
import { ColorField } from '@/features/skins/ColorField';
import { contrastWarning } from '@/features/skins/contrast';
import { styleOf, styleSkinData } from '@/features/skins/figuresData';
import { ImageField } from '@/features/skins/ImageField';
import { MAX_OPACITY } from '@/features/skins/limits';
import { COLOR_FIELDS, STANDARD_DARK, STANDARD_LIGHT } from '@/features/skins/styleDefaults';
import { ToolName } from '@/features/skins/ToolName';
import type { SkinPackActions } from '@/features/skins/useSkinPack';
import type { ImageTarget } from '@/lib/bindings/ImageTarget';
import type { SkinData } from '@/lib/bindings/SkinData';
import type { SkinPack } from '@/lib/bindings/SkinPack';
import type { StyleColors } from '@/lib/bindings/StyleColors';
import type { StyleData } from '@/lib/bindings/StyleData';
import { useSkinsStore } from '@/stores/skins';
import type { StyleScheme } from '@/stores/skins';
import './StyleEditor.css';

interface StyleEditorProps {
  pack: SkinPack;
  actions: SkinPackActions;
}

const SCHEMES: readonly { id: StyleScheme; label: string }[] = [
  { id: 'dark', label: 'Dunkel' },
  { id: 'light', label: 'Hell' },
];

function formatOpacity(value: number): string {
  return `Deckkraft ${String(value)} %`;
}

/** Editor eines Stilpakets: Farben je Schema, Hintergrundbilder mit Deckkraft, App-Symbol. */
export function StyleEditor({ pack, actions }: StyleEditorProps): ReactElement | null {
  const scheme: StyleScheme = useSkinsStore((state) => state.styleScheme);
  const setScheme = useSkinsStore((state) => state.setStyleScheme);
  const [error, setError] = useState<string | null>(null);
  const style: StyleData | null = styleOf(pack.data);
  if (style === null) {
    return null;
  }
  const colors: StyleColors = style[scheme];

  function saveStyle(update: (current: StyleData) => StyleData): void {
    actions
      .save((current: SkinData): SkinData => {
        const currentStyle: StyleData | null = styleOf(current);
        if (currentStyle === null) {
          return current;
        }
        const next: StyleData = update(currentStyle);
        return next === currentStyle ? current : styleSkinData(next);
      })
      .then(setError)
      .catch(() => undefined);
  }

  function setColor(key: keyof StyleColors, value: string): void {
    saveStyle((current: StyleData) => ({
      ...current,
      [scheme]: { ...current[scheme], [key]: value },
    }));
  }

  function resetColors(): void {
    const standard: StyleColors = scheme === 'dark' ? STANDARD_DARK : STANDARD_LIGHT;
    saveStyle((current: StyleData) => ({ ...current, [scheme]: standard }));
  }

  function setOpacity(target: 'sidebar' | 'content', value: number): void {
    saveStyle((current: StyleData) =>
      target === 'sidebar'
        ? { ...current, sidebarOpacity: value }
        : { ...current, contentOpacity: value },
    );
  }

  function renderBackground(
    label: string,
    target: ImageTarget,
    side: 'sidebar' | 'content',
    fileName: string | null,
    opacity: number,
  ): ReactElement {
    return (
      <div className="style-editor__background">
        <ImageField
          label={label}
          pack={pack}
          fileName={fileName}
          kind="figure"
          onSource={(source) => actions.setImage(target, source)}
          onRemove={() => actions.removeImage(target)}
        />
        <div className="style-editor__opacity">
          <span className="style-editor__label">
            {label}: Deckkraft
            <ToolName action="styleSet" />
          </span>
          <Slider
            value={opacity}
            min={0}
            max={MAX_OPACITY}
            step={1}
            label={`Deckkraft ${label}`}
            format={formatOpacity}
            onCommit={(value: number): void => {
              setOpacity(side, value);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="style-editor">
      <section className="style-editor__section">
        <h3 className="style-editor__title">Farben</h3>
        <div className="style-editor__toolbar">
          <span className="style-editor__scheme" role="group" aria-label="Schema">
            {SCHEMES.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className="style-editor__scheme-button"
                aria-pressed={scheme === entry.id}
                onClick={(): void => {
                  setScheme(entry.id);
                }}
              >
                {entry.label}
              </button>
            ))}
          </span>
          <span className="style-editor__hint">
            Das Farbschema unter „Allgemein“ entscheidet, welcher Satz gilt.
          </span>
          <ToolName action="styleSet" />
        </div>
        <div className="style-editor__colors">
          {COLOR_FIELDS.map((field) => (
            <ColorField
              key={`${scheme}-${field.key}`}
              label={field.label}
              value={colors[field.key]}
              warning={contrastWarning(colors, field.key)}
              onCommit={(value: string): void => {
                setColor(field.key, value);
              }}
            />
          ))}
        </div>
        <div className="style-editor__toolbar">
          <button type="button" className="settings-view__button" onClick={resetColors}>
            Farben auf Standard
          </button>
        </div>
      </section>
      <section className="style-editor__section">
        <h3 className="style-editor__title">Hintergrundbilder</h3>
        <div className="style-editor__backgrounds">
          {renderBackground(
            'Seitenleiste',
            { kind: 'sidebarImage' },
            'sidebar',
            style.sidebarImage,
            style.sidebarOpacity,
          )}
          {renderBackground(
            'Inhalt rechts',
            { kind: 'contentImage' },
            'content',
            style.contentImage,
            style.contentOpacity,
          )}
        </div>
        <p className="style-editor__hint">
          Das Bild liegt unter einer Schicht in der Hintergrundfarbe; die Deckkraft ist höchstens{' '}
          {String(MAX_OPACITY)} %, damit Text lesbar bleibt.
        </p>
      </section>
      <section className="style-editor__section">
        <h3 className="style-editor__title">App-Symbol</h3>
        <ImageField
          label="Symbol (PNG oder ICO, quadratisch, mindestens 32 px)"
          pack={pack}
          fileName={style.icon}
          kind="icon"
          onSource={(source) => actions.setImage({ kind: 'icon' }, source)}
          onRemove={() => actions.removeImage({ kind: 'icon' })}
        />
        <p className="style-editor__hint">
          Wechselt im Fenster und in der Taskleiste, solange der Verwalter läuft; die Verknüpfung
          behält das Original.
        </p>
      </section>
      {error !== null && (
        <p className="style-editor__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
