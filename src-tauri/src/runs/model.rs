//! Typen, die einen laufenden Befehl über die Tauri-Grenze beschreiben.
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum ProgressUnit {
    Count,
    Percent,
}

/// Bei `Percent` ist `total` 100.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct RunProgress {
    pub done: u32,
    pub total: u32,
    pub unit: ProgressUnit,
}

/// Stand eines laufenden Vordergrund-Befehls; nur im Speicher.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct RunStatus {
    pub tool_use_id: String,
    /// Was der Befehl bewirkt, in den Worten des Agenten.
    pub description: Option<String>,
    pub command: String,
    /// Millisekunden seit der Epoche.
    pub started_at: f64,
    /// Schätzung der Dauer aus früheren Läufen, in Millisekunden.
    pub expected_ms: Option<f64>,
    pub progress: Option<RunProgress>,
    pub last_line: Option<String>,
}
