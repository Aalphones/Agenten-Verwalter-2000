import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { useState } from 'react';
import type { ReactElement } from 'react';
import { ModeMenu } from '@/components/ModeMenu';
import { ModelMenu } from '@/components/ModelMenu';
import { AccountRow } from '@/features/account/AccountRow';
import { CliVersionRow } from '@/features/cliupdate/CliVersionRow';
import { useKnownRepositories } from '@/features/repositories/useKnownRepositories';
import { ColorSchemeSegment } from '@/features/settings/ColorSchemeSegment';
import { LocalModelMenu } from '@/features/settings/LocalModelMenu';
import { OperatingModeSegment } from '@/features/settings/OperatingModeSegment';
import { SelectButton } from '@/features/settings/SelectButton';
import { SettingRow } from '@/features/settings/SettingRow';
import { useLocalModels } from '@/features/settings/useLocalModels';
import { useSettingsUpdate } from '@/features/settings/useSettingsUpdate';
import { VoiceLanguageSegment } from '@/features/settings/VoiceLanguageSegment';
import type { Effort } from '@/lib/bindings/Effort';
import type { KnownRepository } from '@/lib/bindings/KnownRepository';
import type { Mode } from '@/lib/bindings/Mode';
import type { ModelId } from '@/lib/bindings/ModelId';
import type { OperatingMode } from '@/lib/bindings/OperatingMode';
import type { Settings } from '@/lib/bindings/Settings';
import type { SettingsOverview } from '@/lib/bindings/SettingsOverview';
import { commandErrorText } from '@/lib/errors';
import { effortLabel, localModelLabel, modeOption, modelName } from '@/lib/labels';
import { useSettingsStore } from '@/stores/settings';
import './SettingsView.css';

type OpenMenu = 'model' | 'mode' | 'localModel' | null;

interface SettingsViewProps {
  overview: SettingsOverview | null;
  loadError: string | null;
  onReload: () => void;
}

export function SettingsView({ overview, loadError, onReload }: SettingsViewProps): ReactElement {
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [revealError, setRevealError] = useState<string | null>(null);
  const storedSettings: Settings | null = useSettingsStore((state) => state.settings);
  const { repositories, isLoading: areRepositoriesLoading } = useKnownRepositories();
  const { save, error: saveError } = useSettingsUpdate();

  const settings: Settings | null = storedSettings ?? overview?.settings ?? null;
  const isLocalOperation: boolean = settings !== null && settings.operatingMode !== 'claude';
  const localModels = useLocalModels(isLocalOperation);

  function toggleMenu(menu: Exclude<OpenMenu, null>): void {
    setOpenMenu(openMenu === menu ? null : menu);
  }

  function closeMenu(): void {
    setOpenMenu(null);
  }

  function reveal(path: string): void {
    setRevealError(null);
    revealItemInDir(path).catch((reason: unknown) => {
      console.error('Explorer nicht geöffnet', reason);
      setRevealError(`Explorer nicht geöffnet: ${commandErrorText(reason)}`);
    });
  }

  function saveOperatingMode(operatingMode: OperatingMode): void {
    closeMenu();
    save({ kind: 'operatingMode', value: operatingMode }).catch(() => undefined);
  }

  function saveLocalModel(id: string): void {
    closeMenu();
    save({ kind: 'localModel', value: id }).catch(() => undefined);
  }

  function saveDefaultModel(model: ModelId): void {
    save({ kind: 'defaultModel', value: model }).catch(() => undefined);
  }

  function saveDefaultMode(mode: Mode, effort: Effort): void {
    save({ kind: 'defaultMode', mode, effort }).catch(() => undefined);
  }

  function projectSkillsText(): string {
    if (areRepositoriesLoading) {
      return '…';
    }
    const withSkills: KnownRepository[] = repositories.filter(
      (repository: KnownRepository) => !repository.isMissing && repository.skillCount > 0,
    );
    if (withSkills.length === 0) {
      return 'Keine Repository-Skills';
    }
    return withSkills
      .map((repository: KnownRepository) => `${repository.name} ${String(repository.skillCount)}`)
      .join(' · ');
  }

  function renderRevealButton(path: string): ReactElement {
    return (
      <button
        type="button"
        className="settings-view__button"
        onClick={(): void => {
          reveal(path);
        }}
      >
        Im Explorer zeigen
      </button>
    );
  }

  function renderErrors(): ReactElement | null {
    const sentences: string[] = [];
    if (loadError !== null) {
      sentences.push(`Einstellungen nicht ladbar: ${loadError}`);
    }
    if (saveError !== null) {
      sentences.push(`Nicht gespeichert: ${saveError}`);
    }
    if (revealError !== null) {
      sentences.push(revealError);
    }
    if (sentences.length === 0) {
      return null;
    }
    return (
      <div className="settings-view__errors" role="alert">
        {sentences.map((sentence: string) => (
          <p key={sentence} className="settings-view__error">
            {sentence}
          </p>
        ))}
        {loadError !== null && (
          <button type="button" className="settings-view__button" onClick={onReload}>
            Erneut laden
          </button>
        )}
      </div>
    );
  }

  function renderSections(current: Settings, loaded: SettingsOverview): ReactElement {
    const currentMode = modeOption(current.defaultMode);
    return (
      <>
        {current.operatingMode !== 'standalone' && (
          <section className="settings-view__section">
            <h2 className="settings-view__section-title">Konto</h2>
            <AccountRow />
          </section>
        )}
        {current.operatingMode !== 'standalone' && (
          <section className="settings-view__section">
            <h2 className="settings-view__section-title">Claude Code</h2>
            <CliVersionRow />
          </section>
        )}
        <section className="settings-view__section">
          <h2 className="settings-view__section-title">Darstellung</h2>
          <SettingRow
            label="Farbschema"
            info="System folgt der Windows-Einstellung für hell oder dunkel."
          >
            <ColorSchemeSegment
              value={current.colorScheme}
              onChange={(scheme): void => {
                save({ kind: 'colorScheme', value: scheme }).catch(() => undefined);
              }}
            />
          </SettingRow>
        </section>
        <section className="settings-view__section">
          <h2 className="settings-view__section-title">Agent</h2>
          <SettingRow
            label="Betriebsart"
            info="Claude: Modellanfragen gehen an dein Claude-Abo. Claude Code + LM Studio: dieselbe Claude-Kommandozeile mit Werkzeugen, Skills und Anweisungen, aber das Modell läuft lokal in LM Studio — für die Zeit, in der das Kontingent aufgebraucht ist. Autark: ohne Claude-Kommandozeile und ohne Anthropic — ein eigener, kleinerer Agent des Verwalters mit dem lokalen Modell. Gilt ab der nächsten Nachricht jeder Session."
          >
            <OperatingModeSegment value={current.operatingMode} onChange={saveOperatingMode} />
          </SettingRow>
          {current.operatingMode !== 'claude' && (
            <SettingRow
              label="Lokales Modell"
              info="Ein in LM Studio geladenes Modell. Die Kontextlänge, mit der es dort geladen ist, gilt als Kontextfenster der Sessions. Adresse des Servers: Umgebungsvariable VERWALTER_LMSTUDIO_URL, sonst http://localhost:1234."
            >
              <SelectButton
                label="Lokales Modell"
                value={localModelLabel(current.localModel)}
                isOpen={openMenu === 'localModel'}
                onToggle={(): void => {
                  toggleMenu('localModel');
                }}
              >
                <LocalModelMenu
                  value={current.localModel}
                  models={localModels.models}
                  isLoading={localModels.isLoading}
                  onChange={saveLocalModel}
                  onReload={localModels.reload}
                  onClose={closeMenu}
                />
              </SelectButton>
            </SettingRow>
          )}
          <SettingRow
            label="Standardmodell"
            info="Mit diesem Modell startet die erste Session eines neuen Vorhabens; weitere Sessions im Vorhaben übernehmen den Stand der letzten. In der Session jederzeit über die Eingabeleiste änderbar."
          >
            <SelectButton
              label="Standardmodell"
              value={modelName(current.defaultModel)}
              isOpen={openMenu === 'model'}
              onToggle={(): void => {
                toggleMenu('model');
              }}
            >
              <ModelMenu
                value={current.defaultModel}
                onChange={saveDefaultModel}
                onClose={closeMenu}
                placement="below"
                title="Modell für neue Vorhaben"
                note="Gilt ab dem nächsten neuen Vorhaben."
              />
            </SelectButton>
          </SettingRow>
          <SettingRow
            label="Standard-Modus"
            info="Wie selbstständig Claude arbeitet und wie gründlich es nachdenkt. Gilt für neue Vorhaben; in der Session mit Umschalt + Tab bzw. über die Eingabeleiste wechselbar."
          >
            <SelectButton
              label="Standard-Modus"
              value={`${currentMode.label} · Denkaufwand ${effortLabel(current.defaultEffort)}`}
              isOpen={openMenu === 'mode'}
              onToggle={(): void => {
                toggleMenu('mode');
              }}
            >
              <ModeMenu
                mode={current.defaultMode}
                effort={current.defaultEffort}
                onModeChange={(mode: Mode): void => {
                  saveDefaultMode(mode, current.defaultEffort);
                }}
                onEffortChange={(effort: Effort): void => {
                  saveDefaultMode(current.defaultMode, effort);
                }}
                onClose={closeMenu}
                placement="below"
                align="start"
              />
            </SelectButton>
          </SettingRow>
        </section>
        <section className="settings-view__section">
          <h2 className="settings-view__section-title">Spracheingabe</h2>
          <SettingRow
            label="Sprache"
            info="Automatisch: Whisper erkennt die Sprache selbst, je Satz — bei kurzen Sätzen landet es dabei gern im Englischen. Deutsch bzw. Englisch legt sie fest. Gilt ab dem nächsten Diktat."
          >
            <VoiceLanguageSegment
              value={current.voiceLanguage}
              onChange={(code: string | null): void => {
                save({ kind: 'voiceLanguage', value: code }).catch(() => undefined);
              }}
            />
          </SettingRow>
        </section>
        <section className="settings-view__section">
          <h2 className="settings-view__section-title">Skills</h2>
          <SettingRow
            label="Benutzer-Skills"
            info="Skills aus deinem Benutzerordner stehen in jeder Session zur Verfügung."
          >
            <span className="settings-view__path-text">
              <span className="settings-view__path" title={loaded.userSkillsDir}>
                {loaded.userSkillsDir}
              </span>
              <span className="settings-view__extra">{skillCountLabel(loaded.userSkillCount)}</span>
            </span>
            {renderRevealButton(loaded.userSkillsDir)}
          </SettingRow>
          <SettingRow
            label="Projekt-Skills"
            info="Skills aus den .claude\skills-Ordnern der Repositories einer Session. Welche gelten, hängt davon ab, welche Repositories die Session umfasst."
          >
            <span className="settings-view__path-text">
              <span className="settings-view__plain">{projectSkillsText()}</span>
              {!areRepositoriesLoading && hasProjectSkills(repositories) && (
                <span className="settings-view__extra">je Repository</span>
              )}
            </span>
          </SettingRow>
        </section>
        <section className="settings-view__section">
          <h2 className="settings-view__section-title">Ordner</h2>
          <SettingRow
            label="Workspaces"
            info="Hier legt die App den Workspace jedes Vorhabens an: Arbeitsordner seiner Sessions und Ablage der Anhänge."
          >
            <span className="settings-view__path-text">
              <span className="settings-view__path" title={loaded.workspacesDir}>
                {loaded.workspacesDir}
              </span>
            </span>
            {renderRevealButton(loaded.workspacesDir)}
          </SettingRow>
        </section>
        <section className="settings-view__section">
          <h2 className="settings-view__section-title">Rechte</h2>
          <SettingRow
            label="Dateizugriff"
            info="Ein Agent arbeitet im Workspace seines Vorhabens, in den Haupt-Checkouts von dessen Repositories und in deren Ticket-Worktrees — nicht im übrigen Benutzerverzeichnis."
          >
            <span className="settings-view__plain">Workspace und Repositories des Vorhabens</span>
          </SettingRow>
        </section>
      </>
    );
  }

  function renderBody(): ReactElement | null {
    if (settings === null || overview === null) {
      if (loadError !== null) {
        return null;
      }
      return <p className="settings-view__loading">Lädt …</p>;
    }
    return renderSections(settings, overview);
  }

  return (
    <div className="settings-view">
      <header className="settings-view__header">
        <h1 className="settings-view__title">Einstellungen</h1>
      </header>
      <div className="settings-view__scroll">
        <div className="settings-view__content">
          {renderErrors()}
          {renderBody()}
        </div>
      </div>
    </div>
  );
}

function skillCountLabel(count: number): string {
  return count === 1 ? '1 Skill' : `${String(count)} Skills`;
}

function hasProjectSkills(repositories: readonly KnownRepository[]): boolean {
  return repositories.some(
    (repository: KnownRepository) => !repository.isMissing && repository.skillCount > 0,
  );
}
