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
    /// Browser-Zugriff gewünscht; wirkt ab dem nächsten Start des Agenten.
    pub chrome: bool,
    /// Modell in der Betriebsart Codex; `None` = Standardmodell von Codex.
    pub codex_model: Option<String>,
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
    /// Einstiegszeile der letzten Antwort („Weiter: …“, ADR 027); `None` ohne oder nach einer neueren Nutzernachricht.
    pub handoff_line: Option<String>,
    /// Antwort abgegeben, ein Hintergrund-Befehl ohne lokale Adresse läuft noch (ADR 032); `status` bleibt `Completed`.
    pub awaited_script: Option<AwaitedScript>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct AwaitedScript {
    /// Befehl des ältesten laufenden Eintrags.
    pub title: String,
    /// `started_at` des ältesten laufenden Eintrags, ms seit der Epoche.
    pub started_at: f64,
    /// Zahl der laufenden Einträge, ab 1.
    pub count: u32,
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
