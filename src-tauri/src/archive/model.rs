//! Typen, die das Archiv über die Tauri-Grenze beschreiben (ADR 029).
use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::projects::model::ProjectSummary;
use crate::sessions::model::SessionSummary;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ArchivedProject {
    pub id: String,
    pub name: String,
    pub created_at: f64,
    pub archived_at: f64,
    pub session_count: u32,
    /// Namen der Repositories in Positions-Reihenfolge, aus der Session mit der kleinsten Nummer.
    pub repository_names: Vec<String>,
    /// Leer ohne Suchbegriff oder wenn nur der Name des Vorhabens passt.
    pub snippets: Vec<ArchiveSnippet>,
}

/// Ein Ausschnitt um eine Fundstelle im Chat, ohne Zeilenumbrüche.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveSnippet {
    pub session_name: String,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ArchivePage {
    pub items: Vec<ArchivedProject>,
    /// Nach dieser Seite passt noch mindestens ein weiteres Vorhaben.
    pub has_more: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ProjectRestored {
    pub project: ProjectSummary,
    /// Nach Nummer.
    pub sessions: Vec<SessionSummary>,
}
