use serde::Serialize;
use ts_rs::TS;

/// Ein Repository, das die App kennt, samt Zustand für die Auswahl.
#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct KnownRepository {
    pub id: String,
    pub name: String,
    pub path: String,
    /// Anzahl der Skills unter `.claude/skills` im Repository.
    pub skill_count: u32,
    /// Der Ordner fehlt oder ist kein Git-Repository mehr.
    pub is_missing: bool,
}
