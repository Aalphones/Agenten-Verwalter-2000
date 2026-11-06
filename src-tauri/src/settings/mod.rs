//! Einstellungen der App (ADR 012). Die Datenbank ist die Quelle; fehlt ein Wert oder ist er
//! unlesbar, gilt der Standardwert, ohne dass der gespeicherte Text überschrieben wird.
pub mod model;

use std::collections::HashMap;

use serde::de::DeserializeOwned;
use tauri::AppHandle;

use crate::agents::event::{Effort, Mode, ModelId};
use crate::db::settings as setting_rows;
use crate::db::{Database, enum_from_text, enum_to_text};
use crate::error::CommandError;
use crate::filesystem::workspace::{WORKSPACES_DIR, data_dir, home_dir};
use crate::skills::{self, model::SkillKind, model::SkillOrigin};
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
const KEY_MASTER_DIR: &str = "master_dir";
const KEY_MARK_UNSOURCED: &str = "mark_unsourced";
const KEY_AUTO_COMPACT_STATIONS: &str = "auto_compact_stations";
const KEY_AUTO_COMPACT_THRESHOLD: &str = "auto_compact_threshold";
const KEY_TERMINAL_PLACEMENT: &str = "terminal_placement";
const KEY_TERMINAL_HEIGHT: &str = "terminal_height";
const KEY_TERMINAL_WIDTH: &str = "terminal_width";

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
    master_dir: None,
    mark_unsourced: true,
    auto_compact_stations: true,
    auto_compact_threshold: 250_000,
    terminal_placement: TerminalPlacement::Bottom,
    terminal_height: 260,
    terminal_width: 460,
    panel_widths: PanelWidths {
        sidebar: None,
        changes_tree: None,
        artifacts_list: None,
        background: None,
    },
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
        master_dir: stored
            .get(KEY_MASTER_DIR)
            .map(|text: &String| text.trim())
            .filter(|text: &&str| !text.is_empty())
            .map(str::to_owned),
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
            artifacts_list: stored_panel_width(&stored, PanelId::ArtifactsList),
            background: stored_panel_width(&stored, PanelId::Background),
        },
    })
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
            SettingsChange::MasterDir { value } => {
                // Leer = kein Master-Ordner; `load` liest leere Texte als „nicht gesetzt“.
                setting_rows::write(
                    &transaction,
                    KEY_MASTER_DIR,
                    value.as_deref().map_or("", str::trim),
                )?;
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
