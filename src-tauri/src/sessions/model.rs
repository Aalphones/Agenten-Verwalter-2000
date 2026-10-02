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
    /// Angelegt, Agent nie gestartet (neue Session in einem Vorhaben).
    New,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SessionSummary {
    pub id: String,
    pub name: String,
    /// Anzeige-Status: solange ein Subagent nach der abgegebenen Antwort noch arbeitet, `Running`.
    pub status: SessionStatus,
    /// Der Hauptagent hat abgegeben und wartet auf einen laufenden Subagenten; `status` ist dann `Running`.
    pub awaiting_subagent: bool,
    pub model: ModelId,
    pub effort: Effort,
    pub mode: Mode,
    pub created_at: f64,
    /// Summe der abgeschlossenen Laufzeiten; ein laufender Abschnitt kommt über `running_since` dazu.
    pub running_ms: f64,
    pub running_since: Option<f64>,
    pub context_used: u32,
    pub context_window: u32,
    pub repository_count: u32,
    pub project_id: String,
    /// Laufende Nummer im Vorhaben, ab 1; angezeigt als `#N`.
    pub number: u32,
    /// Server mit Status `Failed` oder `NeedsAuth`; 0 ohne Liste.
    pub mcp_problems: u32,
    /// Letztes Senden des Users oder Abgeben des Agenten (Rückfrage, fertig, Fehler); beim Anlegen `created_at`.
    pub last_activity_at: f64,
    /// Seit dem letzten Blick des Users hat der Agent abgegeben.
    pub unread: bool,
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
