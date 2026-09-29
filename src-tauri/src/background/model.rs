//! Typen, die den Hintergrund einer Session über die Tauri-Grenze beschreiben.
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum BackgroundKind {
    /// Bash-Aufruf des Hauptagenten im Vordergrund.
    Command,
    /// Bash mit `run_in_background`.
    Process,
    /// Aufruf des Werkzeugs `Agent`.
    Subagent,
}

/// `Interrupted`: der Agent-Prozess endete, während der Eintrag lief. Er kann trotzdem
/// weitergelaufen sein — deshalb gibt es bewusst kein „nicht ausgeführt“.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum BackgroundState {
    Running,
    Completed,
    Failed,
    /// Von der App angehalten.
    Stopped,
    Interrupted,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SubagentStep {
    pub tool: String,
    pub target: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct BackgroundItem {
    /// `task_id` bei Prozess und Subagent, `tool_use_id` beim Befehl.
    pub id: String,
    /// Verbindet den Eintrag mit der Werkzeug-Zeile im Chat.
    pub tool_use_id: String,
    pub kind: BackgroundKind,
    pub state: BackgroundState,
    /// Der Befehl (Befehl, Prozess) bzw. die Aufgabe (Subagent).
    pub title: String,
    /// Millisekunden seit der Epoche.
    pub started_at: f64,
    pub ended_at: Option<f64>,
    pub exit_code: Option<i32>,
    pub url: Option<String>,
    pub output_file: Option<String>,
    pub subagent_type: Option<String>,
    /// Modell-ID, wie die Kommandozeile sie meldet.
    pub model: Option<String>,
    pub tool_uses: u32,
    /// Höchstens die letzten 200; ältere fallen weg.
    pub steps: Vec<SubagentStep>,
    pub result: Option<String>,
}

impl BackgroundItem {
    pub fn is_running(&self) -> bool {
        self.state == BackgroundState::Running
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SessionBackground {
    /// Nach `started_at` aufsteigend.
    pub items: Vec<BackgroundItem>,
    pub scratchpad_dir: Option<String>,
}

/// Textvorschau einer Ausgabe oder Datei. `missing`: die Datei gibt es (noch) nicht;
/// `binary`: sie enthält ein NUL-Byte, `text` bleibt dann leer.
#[derive(Debug, Clone, Default, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct TextPreview {
    pub text: String,
    pub truncated: bool,
    pub missing: bool,
    pub binary: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ScratchpadEntry {
    /// Relativ zum Scratchpad, mit `/` getrennt.
    pub path: String,
    pub is_dir: bool,
    /// serde schreibt eine JSON-Zahl, kein `bigint`; bis 2^53 Bytes ist sie in TypeScript genau.
    #[ts(type = "number")]
    pub size_bytes: u64,
    pub modified_ms: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ScratchpadListing {
    /// `None`, solange der Agent der Session noch nie lief.
    pub dir: Option<String>,
    pub entries: Vec<ScratchpadEntry>,
    pub truncated: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct BackgroundChangedEvent {
    pub session_id: String,
}
