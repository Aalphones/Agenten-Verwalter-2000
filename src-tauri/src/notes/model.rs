//! Typen der Notiz eines Vorhabens über die Tauri-Grenze (ADR 074).
use serde::Serialize;
use ts_rs::TS;

/// Der Text der Notiz; fehlt die Datei, ist er leer und `modified_ms` 0.
#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct NoteText {
    pub text: String,
    /// Millisekunden seit Epoche.
    #[ts(type = "number")]
    pub modified_ms: f64,
}

/// Rückmeldung nach dem Schreiben.
#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct NoteSaved {
    /// Millisekunden seit Epoche.
    #[ts(type = "number")]
    pub modified_ms: f64,
}
