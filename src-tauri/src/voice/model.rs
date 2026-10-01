//! Typen des Diktierens, die über die Tauri-Grenze gehen.
use serde::Serialize;
use ts_rs::TS;

#[derive(Debug, Clone, PartialEq, Serialize, TS)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum VoiceModelState {
    Missing,
    /// Bytes als `f64`, damit TypeScript `number` statt `bigint` bekommt.
    #[serde(rename_all = "camelCase")]
    Downloading {
        received_bytes: f64,
        total_bytes: f64,
    },
    Ready,
}

#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct VoiceModelEvent {
    pub state: VoiceModelState,
    /// Nur beim Wechsel nach `Missing` wegen eines fehlgeschlagenen Downloads gesetzt
    /// (Text = `CommandError::VoiceDownload(..).to_string()`); bei Abbruch durch den Nutzer `None`.
    pub error: Option<String>,
}

/// Pegel von 0.0 bis 1.0 (RMS der letzten ~50 ms).
#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct VoiceLevelEvent {
    pub level: f32,
}

/// Der gesamte bisher erkannte Text des laufenden Diktats (nicht nur der neue Abschnitt),
/// getrimmt, nie leer. Die Oberfläche ersetzt damit ihre Vorschau, statt Stücke anzuhängen.
#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct VoicePartialEvent {
    pub text: String,
}
