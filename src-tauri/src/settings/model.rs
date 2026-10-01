use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::agents::event::{Effort, Mode, ModelId};

/// `System` folgt der Windows-Einstellung für hell oder dunkel.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum ColorScheme {
    Dark,
    Light,
    System,
}

/// Werte, die für die ganze App gelten. Modell, Modus und Denkaufwand gelten für die erste Session
/// eines neuen Vorhabens.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub color_scheme: ColorScheme,
    pub default_model: ModelId,
    pub default_effort: Effort,
    pub default_mode: Mode,
}

/// Was die Einstellungsseite zeigt: die Werte und die Ordner, die sie nur anzeigt.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SettingsOverview {
    pub settings: Settings,
    /// Absolut: `<Benutzerordner>\.claude\skills`.
    pub user_skills_dir: String,
    /// Skills des Benutzers ohne Befehle.
    pub user_skill_count: u32,
    /// Absolut: `<Benutzerordner>\.verwalter\workspaces`.
    pub workspaces_dir: String,
}

/// Eine Änderung aus der Einstellungsseite. Modus und Denkaufwand ändern sich gemeinsam, weil sie
/// im selben Menü stehen.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum SettingsChange {
    ColorScheme { value: ColorScheme },
    DefaultModel { value: ModelId },
    DefaultMode { mode: Mode, effort: Effort },
}
