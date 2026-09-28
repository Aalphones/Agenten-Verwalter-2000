use serde::Serialize;
use ts_rs::TS;

/// Fehler, den ein Tauri Command an die Oberfläche meldet.
/// Nutzer-relevante Fälle bekommen eigene Varianten, damit die UI eine passende Aktion anbieten kann.
#[derive(Debug, thiserror::Error, Serialize, TS)]
#[serde(tag = "kind", content = "message", rename_all = "camelCase")]
pub enum CommandError {
    #[error("interner Fehler: {0}")]
    Internal(String),
    #[error("Session nicht gefunden: {0}")]
    SessionNotFound(String),
    #[error("Claude-Kommandozeile nicht gefunden")]
    ClaudeNotFound,
    #[error("Session ist abgebrochen")]
    SessionClosed,
    #[error("Agent läuft nicht")]
    AgentStopped,
    #[error("Dateisystem: {0}")]
    Io(String),
}

impl From<std::io::Error> for CommandError {
    fn from(error: std::io::Error) -> Self {
        CommandError::Io(error.to_string())
    }
}
