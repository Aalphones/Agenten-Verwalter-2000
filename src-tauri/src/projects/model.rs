//! Typen, die ein Vorhaben über die Tauri-Grenze beschreiben.
use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::sessions::model::SessionSummary;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSummary {
    pub id: String,
    pub name: String,
    pub created_at: f64,
    /// Namen der Repositories in Positions-Reihenfolge; für alle Sessions des Vorhabens gleich.
    pub repository_names: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ProjectCreated {
    pub project: ProjectSummary,
    pub session: SessionSummary,
}
