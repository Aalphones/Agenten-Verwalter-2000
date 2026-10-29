//! Typen, die eine Nebenfrage über die Tauri-Grenze beschreiben.
use serde::Serialize;
use ts_rs::TS;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum SideState {
    Running,
    Done,
    Failed,
}

#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SideQuestion {
    pub id: String,
    pub session_id: String,
    pub question: String,
    /// Markierter Text aus dem Chat, höchstens `MAX_QUOTE_CHARS` Zeichen.
    pub quote: Option<String>,
    pub state: SideState,
    /// Gesetzt bei `Done`.
    pub answer: Option<String>,
    /// Gesetzt bei `Failed`.
    pub error: Option<String>,
    /// Millisekunden seit 1970.
    pub asked_at: f64,
    pub answered_at: Option<f64>,
    pub usage: Option<SideUsage>,
}

/// Aus der Antwort der Kommandozeile; `cache_read_tokens` größer null heißt, die Frage las den
/// Verlauf aus dem Prompt-Cache der Session.
#[derive(Debug, Clone, Copy, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SideUsage {
    /// serde schreibt eine JSON-Zahl, kein `bigint`.
    #[ts(type = "number")]
    pub input_tokens: u64,
    #[ts(type = "number")]
    pub cache_read_tokens: u64,
}

#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SideChangedEvent {
    pub session_id: String,
}
