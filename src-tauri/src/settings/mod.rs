//! Einstellungen der App (ADR 012). Die Datenbank ist die Quelle; fehlt ein Wert oder ist er
//! unlesbar, gilt der Standardwert, ohne dass der gespeicherte Text überschrieben wird.
pub mod model;

use std::collections::HashMap;

use rusqlite::Connection;
use serde::de::DeserializeOwned;
use tauri::AppHandle;

use crate::agents::event::{Effort, Mode, ModelId};
use crate::db::settings as setting_rows;
use crate::db::skins as skin_rows;
use crate::db::{Database, enum_from_text, enum_to_text};
use crate::error::CommandError;
use crate::filesystem::workspace::{WORKSPACES_DIR, data_dir, home_dir};
use crate::skills::{self, model::SkillKind, model::SkillOrigin};
use crate::skins::model::SkinKind;
use model::{
    ColorScheme, OperatingMode, PanelId, PanelWidths, Settings, SettingsChange, SettingsOverview,
    TerminalPlacement,
};

const KEY_COLOR_SCHEME: &str = "color_scheme";
const KEY_DEFAULT_MODEL: &str = "default_model";
const KEY_DEFAULT_EFFORT: &str = "default_effort";
const KEY_DEFAULT_MODE: &str = "default_mode";
const KEY_OPERATING_MODE: &str = "operating_mode";
const KEY_LOCAL_MODEL: &str = "local_model";
const KEY_DEFAULT_CODEX_MODEL: &str = "default_codex_model";
const KEY_LIBRARY_DIR: &str = "library_dir";
// Nur noch für die Übernahme in `library_dir_from` und das Leeren in `update` (ADR 069).
const KEY_MASTER_DIR: &str = "master_dir";
const KEY_VAULT_DIR: &str = "vault_dir";
const KEY_VAULT_ENABLED: &str = "vault_enabled";
const KEY_MARK_UNSOURCED: &str = "mark_unsourced";
const KEY_AUTO_COMPACT_STATIONS: &str = "auto_compact_stations";
const KEY_AUTO_COMPACT_THRESHOLD: &str = "auto_compact_threshold";
const KEY_AUTO_CONTINUE_AT_LIMIT: &str = "auto_continue_at_limit";
const KEY_TERMINAL_PLACEMENT: &str = "terminal_placement";
const KEY_TERMINAL_HEIGHT: &str = "terminal_height";
const KEY_TERMINAL_WIDTH: &str = "terminal_width";
const KEY_SKIN_FIGURES: &str = "skin_figures";
const KEY_SKIN_STYLE: &str = "skin_style";
const KEY_SKIN_ANIMATIONS: &str = "skin_animations";
const KEY_SKIN_CELEBRATIONS: &str = "skin_celebrations";
const KEY_SKIN_EASTER_EGGS: &str = "skin_easter_eggs";
const KEY_SKIN_AGENT_TOOLS: &str = "skin_agent_tools";

/// Grenzen für die Schwelle des automatischen Zusammenfassens in Tokens (ADR 058).
pub const AUTO_COMPACT_THRESHOLD_RANGE: std::ops::RangeInclusive<u32> = 150_000..=500_000;

/// Abstand zwischen Fenster und Schwelle; gemessen 06.11.2026: 283 000 → 250 000, 280 000 → 247 000.
pub const AUTO_COMPACT_BUFFER: u32 = 33_000;

/// Fenster für `CLAUDE_CODE_AUTO_COMPACT_WINDOW`; `None`, wenn der Schalter aus ist.
pub fn auto_compact_window(settings: &Settings) -> Option<u32> {
    settings
        .auto_compact_stations
        .then(|| settings.auto_compact_threshold + AUTO_COMPACT_BUFFER)
}

/// Grenzen für die gemerkte Größe des Terminal-Docks in Pixeln.
const TERMINAL_SIZE_RANGE: std::ops::RangeInclusive<u32> = 100..=10000;

/// Grenzen für die gemerkte Breite einer Leiste in Pixeln. Die eigentlichen Mindest- und
/// Standardbreiten kennt nur die Oberfläche (ADR 053).
const PANEL_WIDTH_RANGE: std::ops::RangeInclusive<u32> = 120..=10000;

fn panel_key(panel: PanelId) -> &'static str {
    match panel {
        PanelId::Sidebar => "panel_width.sidebar",
        PanelId::ChangesTree => "panel_width.changes_tree",
        PanelId::FilesTree => "panel_width.files_tree",
        PanelId::ArtifactsList => "panel_width.artifacts_list",
        PanelId::Background => "panel_width.background",
    }
}

fn stored_panel_width(stored: &HashMap<String, String>, panel: PanelId) -> Option<u32> {
    stored
        .get(panel_key(panel))
        .and_then(|text: &String| text.parse::<u32>().ok())
}

/// „Neues Vorhaben“ startet mit denselben Werten, solange die Einstellungen nicht geladen sind.
const DEFAULT_SETTINGS: Settings = Settings {
    color_scheme: ColorScheme::System,
    default_model: ModelId::Sonnet,
    default_effort: Effort::High,
    default_mode: Mode::Auto,
    operating_mode: OperatingMode::Claude,
    local_model: None,
    default_codex_model: None,
    library_dir: None,
    vault_enabled: false,
    mark_unsourced: true,
    auto_compact_stations: true,
    auto_compact_threshold: 250_000,
    auto_continue_at_limit: false,
    terminal_placement: TerminalPlacement::Bottom,
    terminal_height: 260,
    terminal_width: 460,
    panel_widths: PanelWidths {
        sidebar: None,
        changes_tree: None,
        files_tree: None,
        artifacts_list: None,
        background: None,
    },
    skin_figures: None,
    skin_style: None,
    skin_animations: None,
    skin_celebrations: false,
    skin_easter_eggs: false,
    skin_agent_tools: false,
};

pub fn load(database: &Database) -> Result<Settings, CommandError> {
    let stored: HashMap<String, String> =
        database.with(|connection| setting_rows::read_all(connection))?;
    Ok(Settings {
        color_scheme: stored_or(&stored, KEY_COLOR_SCHEME, DEFAULT_SETTINGS.color_scheme),
        default_model: stored_or(&stored, KEY_DEFAULT_MODEL, DEFAULT_SETTINGS.default_model),
        default_effort: stored_or(&stored, KEY_DEFAULT_EFFORT, DEFAULT_SETTINGS.default_effort),
        default_mode: stored_or(&stored, KEY_DEFAULT_MODE, DEFAULT_SETTINGS.default_mode),
        operating_mode: stored_or(&stored, KEY_OPERATING_MODE, DEFAULT_SETTINGS.operating_mode),
        local_model: stored
            .get(KEY_LOCAL_MODEL)
            .map(|text: &String| text.trim())
            .filter(|text: &&str| !text.is_empty())
            .map(str::to_owned),
        default_codex_model: stored
            .get(KEY_DEFAULT_CODEX_MODEL)
            .map(|text: &String| text.trim())
            .filter(|text: &&str| !text.is_empty())
            .map(str::to_owned),
        library_dir: library_dir_from(&stored),
        vault_enabled: stored
            .get(KEY_VAULT_ENABLED)
            .and_then(|text: &String| text.parse::<bool>().ok())
            .unwrap_or(DEFAULT_SETTINGS.vault_enabled),
        mark_unsourced: stored
            .get(KEY_MARK_UNSOURCED)
            .and_then(|text: &String| text.parse::<bool>().ok())
            .unwrap_or(DEFAULT_SETTINGS.mark_unsourced),
        auto_compact_stations: stored
            .get(KEY_AUTO_COMPACT_STATIONS)
            .and_then(|text: &String| text.parse::<bool>().ok())
            .unwrap_or(DEFAULT_SETTINGS.auto_compact_stations),
        auto_compact_threshold: stored
            .get(KEY_AUTO_COMPACT_THRESHOLD)
            .and_then(|text: &String| text.parse::<u32>().ok())
            .filter(|value: &u32| AUTO_COMPACT_THRESHOLD_RANGE.contains(value))
            .unwrap_or(DEFAULT_SETTINGS.auto_compact_threshold),
        auto_continue_at_limit: stored
            .get(KEY_AUTO_CONTINUE_AT_LIMIT)
            .and_then(|text: &String| text.parse::<bool>().ok())
            .unwrap_or(DEFAULT_SETTINGS.auto_continue_at_limit),
        terminal_placement: stored_or(
            &stored,
            KEY_TERMINAL_PLACEMENT,
            DEFAULT_SETTINGS.terminal_placement,
        ),
        terminal_height: stored
            .get(KEY_TERMINAL_HEIGHT)
            .and_then(|text: &String| text.parse::<u32>().ok())
            .unwrap_or(DEFAULT_SETTINGS.terminal_height),
        terminal_width: stored
            .get(KEY_TERMINAL_WIDTH)
            .and_then(|text: &String| text.parse::<u32>().ok())
            .unwrap_or(DEFAULT_SETTINGS.terminal_width),
        panel_widths: PanelWidths {
            sidebar: stored_panel_width(&stored, PanelId::Sidebar),
            changes_tree: stored_panel_width(&stored, PanelId::ChangesTree),
            files_tree: stored_panel_width(&stored, PanelId::FilesTree),
            artifacts_list: stored_panel_width(&stored, PanelId::ArtifactsList),
            background: stored_panel_width(&stored, PanelId::Background),
        },
        skin_figures: active_skin(database, &stored, KEY_SKIN_FIGURES, SkinKind::Figures)?,
        skin_style: active_skin(database, &stored, KEY_SKIN_STYLE, SkinKind::Style)?,
        skin_animations: stored
            .get(KEY_SKIN_ANIMATIONS)
            .and_then(|text: &String| text.parse::<bool>().ok())
            .or(DEFAULT_SETTINGS.skin_animations),
        skin_celebrations: stored
            .get(KEY_SKIN_CELEBRATIONS)
            .and_then(|text: &String| text.parse::<bool>().ok())
            .unwrap_or(DEFAULT_SETTINGS.skin_celebrations),
        skin_easter_eggs: stored
            .get(KEY_SKIN_EASTER_EGGS)
            .and_then(|text: &String| text.parse::<bool>().ok())
            .unwrap_or(DEFAULT_SETTINGS.skin_easter_eggs),
        skin_agent_tools: stored
            .get(KEY_SKIN_AGENT_TOOLS)
            .and_then(|text: &String| text.parse::<bool>().ok())
            .unwrap_or(DEFAULT_SETTINGS.skin_agent_tools),
    })
}

/// Die gespeicherte ID eines Pakets der Art `kind`; `None`, wenn nichts gewählt ist oder das
/// Paket fehlt, gelöscht ist oder eine andere Art hat. Der gespeicherte Text bleibt unberührt:
/// holt der Benutzer das Paket zurück, gilt es wieder.
fn active_skin(
    database: &Database,
    stored: &HashMap<String, String>,
    key: &str,
    kind: SkinKind,
) -> Result<Option<String>, CommandError> {
    let Some(id) = stored
        .get(key)
        .map(|text: &String| text.trim())
        .filter(|text: &&str| !text.is_empty())
    else {
        return Ok(None);
    };
    let found: Option<String> = database.with(|connection| skin_rows::kind_of(connection, id))?;
    let is_matching: bool = found.as_deref() == Some(enum_to_text(&kind)?.as_str());
    Ok(is_matching.then(|| id.to_owned()))
}

/// Schreibt die Wahl eines Pakets; eine ID, die es nicht gibt oder die zur falschen Art gehört,
/// wird mit einem Satz abgelehnt. Leer oder `None` schaltet ab.
fn write_skin_choice(
    connection: &Connection,
    key: &str,
    kind: SkinKind,
    id: Option<&str>,
) -> Result<(), CommandError> {
    let Some(id) = id.map(str::trim).filter(|text: &&str| !text.is_empty()) else {
        return setting_rows::write(connection, key, "");
    };
    let found: Option<String> = skin_rows::kind_of(connection, id)?;
    match found {
        None => Err(CommandError::Skin(
            "Dieses Paket gibt es nicht (mehr).".to_owned(),
        )),
        Some(found_kind) if found_kind != enum_to_text(&kind)? => Err(CommandError::Skin(
            match kind {
                SkinKind::Figures => "Das ist kein Figurenpaket.",
                SkinKind::Style => "Das ist kein Stilpaket.",
            }
            .to_owned(),
        )),
        Some(_) => setting_rows::write(connection, key, id),
    }
}

/// Speichert genau die geänderten Schlüssel und gibt den ganzen neuen Stand zurück.
pub fn update(database: &Database, change: SettingsChange) -> Result<Settings, CommandError> {
    if let SettingsChange::LocalModel { value } = &change
        && value.trim().is_empty()
    {
        return Err(CommandError::Internal("Modellname leer".to_owned()));
    }
    if let SettingsChange::TerminalHeight { value } | SettingsChange::TerminalWidth { value } =
        &change
        && !TERMINAL_SIZE_RANGE.contains(value)
    {
        return Err(CommandError::Internal(
            "Terminalgröße außerhalb 100–10000 px".to_owned(),
        ));
    }
    if let SettingsChange::AutoCompactThreshold { value } = &change
        && !AUTO_COMPACT_THRESHOLD_RANGE.contains(value)
    {
        return Err(CommandError::Internal(
            "Schwelle außerhalb 150 000–500 000 Tokens".to_owned(),
        ));
    }
    if let SettingsChange::PanelWidth {
        value: Some(width), ..
    } = &change
        && !PANEL_WIDTH_RANGE.contains(width)
    {
        return Err(CommandError::Internal(
            "Leistenbreite außerhalb 120–10000 px".to_owned(),
        ));
    }
    database.with(|connection| {
        let transaction = connection.transaction()?;
        match change {
            SettingsChange::ColorScheme { value } => {
                setting_rows::write(&transaction, KEY_COLOR_SCHEME, &enum_to_text(&value)?)?;
            }
            SettingsChange::DefaultModel { value } => {
                setting_rows::write(&transaction, KEY_DEFAULT_MODEL, &enum_to_text(&value)?)?;
            }
            SettingsChange::DefaultMode { mode, effort } => {
                setting_rows::write(&transaction, KEY_DEFAULT_MODE, &enum_to_text(&mode)?)?;
                setting_rows::write(&transaction, KEY_DEFAULT_EFFORT, &enum_to_text(&effort)?)?;
            }
            SettingsChange::OperatingMode { value } => {
                setting_rows::write(&transaction, KEY_OPERATING_MODE, &enum_to_text(&value)?)?;
            }
            SettingsChange::LocalModel { value } => {
                setting_rows::write(&transaction, KEY_LOCAL_MODEL, value.trim())?;
            }
            SettingsChange::DefaultCodexModel { value } => {
                // Leer = Standardmodell; `load` liest leere Texte als „nicht gesetzt“.
                setting_rows::write(
                    &transaction,
                    KEY_DEFAULT_CODEX_MODEL,
                    value.as_deref().map_or("", str::trim),
                )?;
            }
            SettingsChange::LibraryDir { value } => {
                // Leer = kein Ordner; `load` liest leere Texte als „nicht gesetzt“. Die alten
                // Schlüssel werden geleert, damit sie nach „Entfernen“ nicht zurückkehren.
                setting_rows::write(
                    &transaction,
                    KEY_LIBRARY_DIR,
                    value.as_deref().map_or("", str::trim),
                )?;
                setting_rows::write(&transaction, KEY_MASTER_DIR, "")?;
                setting_rows::write(&transaction, KEY_VAULT_DIR, "")?;
            }
            SettingsChange::VaultEnabled { value } => {
                setting_rows::write(&transaction, KEY_VAULT_ENABLED, &value.to_string())?;
            }
            SettingsChange::MarkUnsourced { value } => {
                setting_rows::write(&transaction, KEY_MARK_UNSOURCED, &value.to_string())?;
            }
            SettingsChange::AutoCompactStations { value } => {
                setting_rows::write(&transaction, KEY_AUTO_COMPACT_STATIONS, &value.to_string())?;
            }
            SettingsChange::AutoCompactThreshold { value } => {
                setting_rows::write(&transaction, KEY_AUTO_COMPACT_THRESHOLD, &value.to_string())?;
            }
            SettingsChange::AutoContinueAtLimit { value } => {
                setting_rows::write(&transaction, KEY_AUTO_CONTINUE_AT_LIMIT, &value.to_string())?;
            }
            SettingsChange::TerminalPlacement { value } => {
                setting_rows::write(&transaction, KEY_TERMINAL_PLACEMENT, &enum_to_text(&value)?)?;
            }
            SettingsChange::TerminalHeight { value } => {
                setting_rows::write(&transaction, KEY_TERMINAL_HEIGHT, &value.to_string())?;
            }
            SettingsChange::TerminalWidth { value } => {
                setting_rows::write(&transaction, KEY_TERMINAL_WIDTH, &value.to_string())?;
            }
            SettingsChange::PanelWidth { panel, value } => match value {
                Some(width) => {
                    setting_rows::write(&transaction, panel_key(panel), &width.to_string())?;
                }
                None => setting_rows::delete(&transaction, panel_key(panel))?,
            },
            SettingsChange::SkinFigures { value } => {
                write_skin_choice(
                    &transaction,
                    KEY_SKIN_FIGURES,
                    SkinKind::Figures,
                    value.as_deref(),
                )?;
            }
            SettingsChange::SkinStyle { value } => {
                write_skin_choice(
                    &transaction,
                    KEY_SKIN_STYLE,
                    SkinKind::Style,
                    value.as_deref(),
                )?;
            }
            SettingsChange::SkinAnimations { value } => {
                setting_rows::write(&transaction, KEY_SKIN_ANIMATIONS, &value.to_string())?;
            }
            SettingsChange::SkinCelebrations { value } => {
                setting_rows::write(&transaction, KEY_SKIN_CELEBRATIONS, &value.to_string())?;
            }
            SettingsChange::SkinEasterEggs { value } => {
                setting_rows::write(&transaction, KEY_SKIN_EASTER_EGGS, &value.to_string())?;
            }
            SettingsChange::SkinAgentTools { value } => {
                setting_rows::write(&transaction, KEY_SKIN_AGENT_TOOLS, &value.to_string())?;
            }
        }
        transaction.commit()?;
        Ok(())
    })?;
    load(database)
}

pub fn overview(app: &AppHandle, database: &Database) -> Result<SettingsOverview, CommandError> {
    let settings = load(database)?;
    let home = home_dir(app)?;
    let user_skill_count = skills::collect(&home, &[])
        .iter()
        .filter(|skill: &&skills::model::SkillInfo| {
            skill.kind == SkillKind::Skill && matches!(skill.origin, SkillOrigin::User)
        })
        .count();
    Ok(SettingsOverview {
        settings,
        user_skills_dir: skills::skills_dir(&home).to_string_lossy().into_owned(),
        user_skill_count: u32::try_from(user_skill_count).unwrap_or(u32::MAX),
        workspaces_dir: data_dir(app)?
            .join(WORKSPACES_DIR)
            .to_string_lossy()
            .into_owned(),
    })
}

fn stored_or<T: DeserializeOwned>(stored: &HashMap<String, String>, key: &str, default: T) -> T {
    stored
        .get(key)
        .and_then(|text: &String| enum_from_text(text).ok())
        .unwrap_or(default)
}

/// Der Ordner der Bibliothek aus den gespeicherten Einstellungen (ADR 069).
///
/// Steht der Schlüssel `library_dir` (auch leer), gilt er; sonst der
/// bisherige `master_dir`, sonst der bisherige `vault_dir`.
fn library_dir_from(stored: &HashMap<String, String>) -> Option<String> {
    let trimmed = |key: &str| -> Option<String> {
        stored
            .get(key)
            .map(|text: &String| text.trim())
            .filter(|text: &&str| !text.is_empty())
            .map(str::to_owned)
    };
    if stored.contains_key(KEY_LIBRARY_DIR) {
        return trimmed(KEY_LIBRARY_DIR);
    }
    trimmed(KEY_MASTER_DIR).or_else(|| trimmed(KEY_VAULT_DIR))
}

#[cfg(test)]
mod library_dir_tests {
    use super::*;

    fn stored(pairs: &[(&str, &str)]) -> HashMap<String, String> {
        pairs
            .iter()
            .map(|(key, value)| ((*key).to_owned(), (*value).to_owned()))
            .collect()
    }

    #[test]
    fn nur_master_dir_wird_zum_ordner() {
        let rows = stored(&[(KEY_MASTER_DIR, r"G:\Meine Ablage\U104_Agents")]);
        assert_eq!(
            library_dir_from(&rows),
            Some(r"G:\Meine Ablage\U104_Agents".to_owned())
        );
    }

    #[test]
    fn nur_vault_dir_wird_zum_ordner() {
        let rows = stored(&[(KEY_VAULT_DIR, r"D:\Vault")]);
        assert_eq!(library_dir_from(&rows), Some(r"D:\Vault".to_owned()));
    }

    #[test]
    fn master_dir_geht_vor_vault_dir() {
        let rows = stored(&[(KEY_MASTER_DIR, r"G:\Master"), (KEY_VAULT_DIR, r"D:\Vault")]);
        assert_eq!(library_dir_from(&rows), Some(r"G:\Master".to_owned()));
    }

    #[test]
    fn leerer_master_dir_faellt_auf_vault_dir_zurueck() {
        let rows = stored(&[(KEY_MASTER_DIR, "  "), (KEY_VAULT_DIR, r"D:\Vault")]);
        assert_eq!(library_dir_from(&rows), Some(r"D:\Vault".to_owned()));
    }

    #[test]
    fn leerer_library_dir_neben_master_dir_ist_kein_ordner() {
        let rows = stored(&[(KEY_LIBRARY_DIR, ""), (KEY_MASTER_DIR, r"G:\Master")]);
        assert_eq!(library_dir_from(&rows), None);
    }

    #[test]
    fn leerer_library_dir_neben_beiden_alten_ist_kein_ordner() {
        let rows = stored(&[
            (KEY_LIBRARY_DIR, "   "),
            (KEY_MASTER_DIR, r"G:\Master"),
            (KEY_VAULT_DIR, r"D:\Vault"),
        ]);
        assert_eq!(library_dir_from(&rows), None);
    }

    #[test]
    fn gesetzter_library_dir_geht_vor_den_alten() {
        let rows = stored(&[
            (KEY_LIBRARY_DIR, r"E:\Bibliothek"),
            (KEY_MASTER_DIR, r"G:\Master"),
            (KEY_VAULT_DIR, r"D:\Vault"),
        ]);
        assert_eq!(library_dir_from(&rows), Some(r"E:\Bibliothek".to_owned()));
    }

    #[test]
    fn library_dir_wird_getrimmt() {
        let rows = stored(&[(KEY_LIBRARY_DIR, "  E:\\Bibliothek \n")]);
        assert_eq!(library_dir_from(&rows), Some(r"E:\Bibliothek".to_owned()));
    }

    #[test]
    fn uebernommener_master_dir_wird_getrimmt() {
        let rows = stored(&[(KEY_MASTER_DIR, " G:\\Master ")]);
        assert_eq!(library_dir_from(&rows), Some(r"G:\Master".to_owned()));
    }

    #[test]
    fn ohne_jede_einstellung_ist_kein_ordner_gewaehlt() {
        assert_eq!(library_dir_from(&stored(&[])), None);
    }

    #[test]
    fn nach_dem_entfernen_kehrt_kein_alter_ordner_zurueck() {
        // Entfernen schreibt library_dir, master_dir und vault_dir leer (Kontrakt).
        let rows = stored(&[
            (KEY_LIBRARY_DIR, ""),
            (KEY_MASTER_DIR, ""),
            (KEY_VAULT_DIR, ""),
        ]);
        assert_eq!(library_dir_from(&rows), None);
    }
}
