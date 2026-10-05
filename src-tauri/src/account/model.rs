//! Typen, die das Claude-Konto über die Tauri-Grenze beschreiben.
use serde::Serialize;
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct AccountInfo {
    pub logged_in: bool,
    pub email: Option<String>,
    pub org_name: Option<String>,
    /// `subscriptionType`, z.B. `pro`.
    pub plan: Option<String>,
    /// `authMethod`, z.B. `claude.ai`.
    pub auth_method: Option<String>,
}

#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct AccountStatus {
    /// Der letzte erfolgreich gelesene Stand; `None` vor dem ersten Lesen. Ein gescheitertes Lesen
    /// lässt ihn stehen.
    pub info: Option<AccountInfo>,
    /// Fehler des letzten Lesens, `None` nach einem Erfolg.
    pub error: Option<String>,
    pub is_logging_in: bool,
}
