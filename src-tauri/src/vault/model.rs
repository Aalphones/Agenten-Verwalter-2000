//! Typen, die den Stand des Developer Vault über die Tauri-Grenze beschreiben (ADR 068).
use serde::Serialize;
use ts_rs::TS;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum VaultState {
    /// Kein Ordner gewählt oder der Schalter ist aus.
    Off,
    /// Der gewählte Ordner existiert nicht.
    Missing,
    Scanning,
    Ready,
    /// Der Ordner ist unbrauchbar oder der Abgleich ist gescheitert.
    Error,
}

#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct VaultStatus {
    pub state: VaultState,
    pub dir: Option<String>,
    /// Zeilen in `files`.
    pub files: u32,
    /// Zeilen in `artifacts`.
    pub artifacts: u32,
    /// Zeilen in `files` mit gesetztem `error`.
    pub skipped: u32,
    /// Ende des letzten vollständigen Abgleichs in ms seit Epoche.
    pub scanned_at: Option<i64>,
    /// Ein Satz zu `Missing` und `Error`, sonst `None`.
    pub message: Option<String>,
    /// Der Ordner existiert und enthält keine sichtbaren Einträge.
    pub is_empty_dir: bool,
}
