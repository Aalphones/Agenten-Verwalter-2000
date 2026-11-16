import type { ReactElement } from 'react';
import { Switch } from '@/components/Switch';
import { SkinPackList } from '@/features/skins/SkinPackList';
import { ToolName } from '@/features/skins/ToolName';
import { useSkinAnimations } from '@/features/skins/useSkinAnimations';
import { SettingRow } from '@/features/settings/SettingRow';
import type { Settings } from '@/lib/bindings/Settings';
import type { SettingsChange } from '@/lib/bindings/SettingsChange';
import type { SkinKind } from '@/lib/bindings/SkinKind';
import type { SkinPackSummary } from '@/lib/bindings/SkinPackSummary';
import { useSkinsStore } from '@/stores/skins';
import './SkinSettingRow.css';

/** Die Zeilen der Kategorie „Skins“ auf der Einstellungsseite. */
export type SkinSettingId =
  | 'skinFigures'
  | 'skinAnimations'
  | 'skinCelebrations'
  | 'skinEasterEggs'
  | 'skinStyle'
  | 'skinPacks'
  | 'skinAgentTools'
  | 'skinToolNames';

const NEEDS_FIGURES = 'Wirkt erst mit einem Figurenpaket';

interface SkinSettingRowProps {
  id: SkinSettingId;
  settings: Settings;
  packs: readonly SkinPackSummary[] | null;
  packsError: string | null;
  save: (change: SettingsChange) => Promise<boolean>;
}

function activeIdOf(settings: Settings, kind: SkinKind): string | null {
  return kind === 'figures' ? settings.skinFigures : settings.skinStyle;
}

function activate(kind: SkinKind, id: string | null): SettingsChange {
  return kind === 'figures' ? { kind: 'skinFigures', value: id } : { kind: 'skinStyle', value: id };
}

/** Eine Zeile der Kategorie „Skins“: Paketauswahl, Schalter oder die Paketliste. */
export function SkinSettingRow({
  id,
  settings,
  packs,
  packsError,
  save,
}: SkinSettingRowProps): ReactElement {
  const areAnimationsOn: boolean = useSkinAnimations();
  const showToolNames: boolean = useSkinsStore((state) => state.showToolNames);
  const setShowToolNames = useSkinsStore((state) => state.setShowToolNames);
  const hasFigures: boolean = settings.skinFigures !== null;

  function persist(change: SettingsChange): void {
    save(change).catch(() => undefined);
  }

  function renderSelect(kind: SkinKind, offLabel: string, label: string): ReactElement {
    const activeId: string | null = activeIdOf(settings, kind);
    const ofKind: readonly SkinPackSummary[] = (packs ?? []).filter(
      (pack: SkinPackSummary) => pack.kind === kind,
    );
    const value: string = ofKind.some((pack: SkinPackSummary) => pack.id === activeId)
      ? (activeId ?? '')
      : '';
    return (
      <SettingRow id={id}>
        <select
          className="skin-setting__select"
          aria-label={label}
          value={value}
          onChange={(event) => {
            persist(activate(kind, event.target.value === '' ? null : event.target.value));
          }}
        >
          <option value="">{offLabel}</option>
          {ofKind.map((pack: SkinPackSummary) => (
            <option key={pack.id} value={pack.id}>
              {pack.name}
            </option>
          ))}
        </select>
        <ToolName action="activate" />
      </SettingRow>
    );
  }

  function renderSwitch(
    label: string,
    checked: boolean,
    stateText: string,
    onChange: (next: boolean) => void,
    isDisabled = false,
  ): ReactElement {
    return (
      <SettingRow id={id}>
        <Switch checked={checked} label={label} disabled={isDisabled} onChange={onChange} />
        <span className="skin-setting__state">{stateText}</span>
      </SettingRow>
    );
  }

  switch (id) {
    case 'skinFigures':
      return renderSelect('figures', 'Aus', 'Figurenpaket');
    case 'skinStyle':
      return renderSelect('style', 'Standard', 'Stilpaket');
    case 'skinAnimations': {
      const isOn: boolean = areAnimationsOn && hasFigures;
      let stateText: string = NEEDS_FIGURES;
      if (hasFigures) {
        stateText = isOn ? 'An – Figuren bewegen sich' : 'Aus – Figuren stehen still';
      }
      return renderSwitch(
        'Animationen',
        isOn,
        stateText,
        (next: boolean): void => {
          persist({ kind: 'skinAnimations', value: next });
        },
        !hasFigures,
      );
    }
    case 'skinCelebrations': {
      const isOn: boolean = settings.skinCelebrations && hasFigures;
      let stateText: string = NEEDS_FIGURES;
      if (hasFigures) {
        stateText = isOn
          ? 'An – Commit und Station werden gefeiert'
          : 'Aus – Erfolg steht nur im Verlauf';
      }
      return renderSwitch(
        'Feier-Momente',
        isOn,
        stateText,
        (next: boolean): void => {
          persist({ kind: 'skinCelebrations', value: next });
        },
        !hasFigures,
      );
    }
    case 'skinEasterEggs':
      return renderSwitch(
        'Easter Eggs',
        settings.skinEasterEggs,
        settings.skinEasterEggs ? 'An – nur auf eigene Aktion' : 'Aus',
        (next: boolean): void => {
          persist({ kind: 'skinEasterEggs', value: next });
        },
      );
    case 'skinAgentTools':
      return renderSwitch(
        'Agent darf Skins bearbeiten',
        settings.skinAgentTools,
        settings.skinAgentTools
          ? 'An – 13 Werkzeuge ab dem nächsten Start'
          : 'Aus – der Agent sieht keine Skin-Werkzeuge',
        (next: boolean): void => {
          persist({ kind: 'skinAgentTools', value: next });
        },
      );
    case 'skinToolNames':
      return renderSwitch(
        'Werkzeug-Namen zeigen',
        showToolNames,
        showToolNames ? 'An' : 'Aus',
        setShowToolNames,
      );
    case 'skinPacks':
      return (
        <SettingRow id={id} isStacked>
          <SkinPackList
            packs={packs}
            loadError={packsError}
            isActive={(pack: SkinPackSummary): boolean =>
              activeIdOf(settings, pack.kind) === pack.id
            }
            onDeactivate={async (pack: SkinPackSummary): Promise<void> => {
              if (!(await save(activate(pack.kind, null)))) {
                throw new Error('Die Auswahl konnte nicht aufgehoben werden.');
              }
            }}
            onReactivate={async (pack: SkinPackSummary): Promise<void> => {
              await save(activate(pack.kind, pack.id));
            }}
          />
        </SettingRow>
      );
    default:
      return assertNever(id);
  }
}

function assertNever(value: never): never {
  throw new Error(`Zeile ohne Zweig in SkinSettingRow: ${String(value)}`);
}
