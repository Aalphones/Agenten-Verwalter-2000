use serde::Serialize;
use ts_rs::TS;

/// Fehler, den ein Tauri Command an die Oberfläche meldet.
/// Nutzer-relevante Fälle bekommen später eigene Varianten (siehe rust.md).
#[derive(Debug, thiserror::Error, Serialize, TS)]
#[serde(tag = "kind", content = "message", rename_all = "camelCase")]
pub enum CommandError {
    #[error("interner Fehler: {0}")]
    Internal(String),
}
