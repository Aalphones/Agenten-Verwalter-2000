//! Typen, die eine Session über die Tauri-Grenze beschreiben.
use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::agents::event::{ChatEntry, Effort, Mode, ModelId};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum SessionStatus {
    Starting,
    Running,
    Waiting,
    Paused,
    Completed,
    Cancelled,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SessionSummary {
    pub id: String,
    pub name: String,
    pub status: SessionStatus,
    pub model: ModelId,
    pub effort: Effort,
    pub mode: Mode,
    pub created_at: f64,
    /// Summe der abgeschlossenen Laufzeiten; ein laufender Abschnitt kommt über `running_since` dazu.
    pub running_ms: f64,
    pub running_since: Option<f64>,
    pub context_used: u32,
    pub context_window: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ChatPage {
    pub entries: Vec<ChatEntry>,
    pub has_more: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ChatEntryEvent {
    pub session_id: String,
    pub entry: ChatEntry,
}
