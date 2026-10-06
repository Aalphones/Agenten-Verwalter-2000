//! Typen, die die MCP-Server einer Session über die Tauri-Grenze beschreiben.
use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// Zustand eines Servers laut `mcp_status`. Unbekannte Werte der Kommandozeile → `Unknown`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum McpServerStatus {
    Connected,
    Pending,
    Failed,
    NeedsAuth,
    Disabled,
    Unknown,
}

impl McpServerStatus {
    pub fn from_cli(value: &str) -> Self {
        match value {
            "connected" => McpServerStatus::Connected,
            "pending" => McpServerStatus::Pending,
            "failed" => McpServerStatus::Failed,
            "needs-auth" => McpServerStatus::NeedsAuth,
            "disabled" => McpServerStatus::Disabled,
            _ => McpServerStatus::Unknown,
        }
    }

    pub fn is_problem(self) -> bool {
        matches!(self, McpServerStatus::Failed | McpServerStatus::NeedsAuth)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct McpServer {
    pub name: String,
    pub status: McpServerStatus,
    /// Herkunft wie von der Kommandozeile gemeldet (`user`, `project`, `local`, `claudeai`, `dynamic` …); leer, wenn sie fehlt.
    pub scope: String,
    /// Kurzform der Verbindung: `stdio · comfy-mcp.exe`, `HTTPS · mcp.alphavantage.co`; leer, wenn nichts davon lesbar ist.
    pub connection: String,
    /// Werkzeugnamen in der Reihenfolge der Kommandozeile; leer, solange der Server nicht verbunden ist.
    pub tools: Vec<String>,
    /// Fehlertext der Kommandozeile bei `Failed`.
    pub error: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum McpAction {
    Reconnect,
    Enable,
    Disable,
    Authenticate,
}

/// Eine gestartete Anmeldung, deren Abschluss noch nicht in `mcp_status` zu sehen ist.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct McpAuthWait {
    pub server: String,
    /// Die Anmeldeseite; immer `https://`.
    pub url: String,
    /// `true`: die Kommandozeile wartet auf den Rücksprung und verbindet selbst neu. `false` (claude.ai): danach neu verbinden.
    pub callback_expected: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct McpActionError {
    pub server: String,
    pub action: McpAction,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SessionMcp {
    /// `None`: kein Stand (Agent läuft nicht oder die erste Antwort steht aus).
    pub servers: Option<Vec<McpServer>>,
    /// Namen der Server mit laufender Aktion.
    pub busy: Vec<String>,
    /// Fehler der letzten gescheiterten Aktion; die nächste Aktion löscht ihn.
    pub error: Option<McpActionError>,
    /// Offene Anmeldung; `None`, wenn keine läuft.
    pub auth: Option<McpAuthWait>,
    /// Millisekunden seit 1970, gesetzt beim Eintreffen der Liste.
    pub fetched_at: Option<f64>,
    pub is_agent_running: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct McpChangedEvent {
    pub session_id: String,
}
