//! Typen, die eine Vorhaben-Retro über die Tauri-Grenze beschreiben.
use serde::Serialize;
use ts_rs::TS;

/// Das Ergebnis eines Retro-Laufs: wo die Dateien liegen und wie viele Sessions einbezogen wurden.
#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct RetroExport {
    /// Relativ zum Workspace, mit `/` getrennt, z. B. `.retro/lauf-1759830000000`.
    pub folder: String,
    pub session_count: u32,
    /// Sessions, deren Mini-Retro fehlschlug (stehen mit Fehlertext in `befunde.md`).
    pub failed_count: u32,
}

/// Fortschritt eines Laufs: nach dem Start (`done = 0`) und nach jeder fertigen Session.
#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct RetroProgress {
    pub project_id: String,
    pub done: u32,
    pub total: u32,
}
