//! Typen, die das Kontingent des Claude-Abos über die Tauri-Grenze beschreiben.
use serde::Serialize;
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct UsageLimit {
    /// Beobachtet `session` (5-Stunden-Fenster) und `weekly_all` (Woche).
    pub kind: String,
    /// 0–100.
    pub percent: u32,
    /// Beobachtet nur `normal`; fehlt der Wert, steht hier `normal`.
    pub severity: String,
    /// ISO-8601 mit Zeitzone, unverändert von der Kommandozeile.
    pub resets_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct UsageShare {
    /// Bei Verhalten der Schlüssel (`long_context`, `cron`, `high_parallel`), bei Skills der Name.
    pub key: String,
    /// 0–100.
    pub percent: u32,
}

#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct UsageBreakdown {
    pub request_count: u32,
    pub session_count: u32,
    pub behaviors: Vec<UsageShare>,
    pub skills: Vec<UsageShare>,
}

#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct UsageSnapshot {
    /// `subscription_type`, z.B. `pro`.
    pub plan: Option<String>,
    pub limits: Vec<UsageLimit>,
    pub day: Option<UsageBreakdown>,
    pub week: Option<UsageBreakdown>,
    /// Millisekunden seit 1970; gesetzt beim Eintreffen im Core.
    pub fetched_at: f64,
}

#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct UsageStatus {
    /// Der letzte erfolgreiche Stand; ein fehlgeschlagener Abruf lässt ihn stehen.
    pub snapshot: Option<UsageSnapshot>,
    /// Fehler des letzten Abrufs, `None` nach einem Erfolg.
    pub error: Option<String>,
    pub is_loading: bool,
}
